"""Point d'entrée FastAPI — backend appel sécurisée par QR."""

from __future__ import annotations

import io
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated
from urllib.parse import quote

import qrcode
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.config import Settings, settings
from app.geo import inside_geofence
from app.gmail_notify import send_gmail_simple
from app.google_auth import (
    build_google_login_url,
    consume_pending,
    create_pending_scan,
    exchange_code_and_get_profile,
    load_oauth_client,
    qr_scan_url,
    redirect_uri,
    sign_oauth_state,
    verify_oauth_state,
)
from app.tokens import mint_token, verify_token

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Dossier projet (indépendant du répertoire de travail au lancement d’uvicorn)
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

# Sessions professeur en mémoire (MVP ; persistance → PostgreSQL plus tard)
SESSIONS: dict[str, dict] = {}
ATTENDANCE_LOG: list[dict] = []


def get_settings() -> Settings:
    return settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    public_url = settings.resolved_public_base_url()
    app.state.public_base_url = public_url
    logger.info("Mode en ligne — URL publique : %s", public_url)
    logger.info(
        "Géofence %.0fm — TTL jeton %ss",
        settings.geofence_radius_meters,
        settings.token_ttl_seconds,
    )
    yield


def _public_url(request: Request) -> str:
    return request.app.state.public_base_url


app = FastAPI(title="Appel QR sécurisé", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def _render_qr_png(data: str) -> io.BytesIO:
    """QR lisible sur vidéoprojecteur (taille + marge)."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=12,
        border=3,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0f172a", back_color="#ffffff")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def client_public_ip(request: Request) -> str:
    """Prend en compte un reverse-proxy typique (X-Forwarded-For)."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return ""


class StartSessionBody(BaseModel):
    room_name: str = Field(..., description="Nom de la salle ou du cours")


class StartSessionResponse(BaseModel):
    session_id: str
    qr_refresh_seconds: int
    teacher_url: str


@app.post("/api/sessions", response_model=StartSessionResponse)
def start_session(body: StartSessionBody):
    sid = str(uuid.uuid4())
    SESSIONS[sid] = {"room": body.room_name}
    base = "/static/teacher.html"
    return StartSessionResponse(
        session_id=sid,
        qr_refresh_seconds=settings.qr_refresh_seconds,
        teacher_url=f"{base}?session={sid}",
    )


@app.get("/api/sessions/{session_id}/info")
def session_info(session_id: str):
    """Métadonnées session (affichage page professeur)."""
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session inconnue")
    return {"room": SESSIONS[session_id]["room"]}


@app.get("/api/sessions/{session_id}/token")
def get_current_token(session_id: str, s: Annotated[Settings, Depends(get_settings)]):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session inconnue")
    token = mint_token(s.app_secret, session_id, s.token_ttl_seconds)
    return {
        "token": token,
        "expires_in": s.token_ttl_seconds,
        "refresh_in": s.qr_refresh_seconds,
    }


def _qr_payload_url(session_id: str, s: Settings, public_url: str) -> str:
    """URL dans le QR : page /scan puis redirection vers Google."""
    token = mint_token(s.app_secret, session_id, s.token_ttl_seconds)
    return qr_scan_url(public_url, token)


@app.get("/api/sessions/{session_id}/qr.png")
def get_qr_png(
    session_id: str,
    request: Request,
    s: Annotated[Settings, Depends(get_settings)],
):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session inconnue")
    buf = _render_qr_png(_qr_payload_url(session_id, s, _public_url(request)))
    return StreamingResponse(buf, media_type="image/png", headers={"Cache-Control": "no-store"})


@app.get("/api/sessions/{session_id}/qr-url")
def get_qr_url(
    session_id: str,
    request: Request,
    s: Annotated[Settings, Depends(get_settings)],
):
    """URL encodée dans le QR (debug / copier-coller)."""
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session inconnue")
    return {"url": _qr_payload_url(session_id, s, _public_url(request))}


@app.get("/scan")
async def scan_entry(t: str, s: Annotated[Settings, Depends(get_settings)]):
    """
    Point d'entrée après lecture du QR : vérifie le jeton puis demande la position GPS
    (périmètre 200 m) avant la connexion Google.
    """
    session_id = verify_token(s.app_secret, t, s.token_ttl_seconds)
    if not session_id or session_id not in SESSIONS:
        return RedirectResponse(
            url="/static/scan_result.html?ok=0&msg="
            + "Code+expiré+ou+invalide.+Scannez+le+QR+affiché+en+salle.",
            status_code=302,
        )

    return RedirectResponse(
        url=f"/static/scan_geo.html?t={quote(t, safe='')}",
        status_code=302,
    )


@app.get("/scan/oauth")
async def scan_oauth(
    request: Request,
    t: str,
    latitude: float,
    longitude: float,
    s: Annotated[Settings, Depends(get_settings)],
):
    """Après GPS : vérifie le périmètre puis redirige vers Google OAuth."""
    session_id = verify_token(s.app_secret, t, s.token_ttl_seconds)
    if not session_id or session_id not in SESSIONS:
        return RedirectResponse(
            url="/static/scan_result.html?ok=0&msg=Code+expiré+ou+invalide.",
            status_code=302,
        )

    if not inside_geofence(
        latitude,
        longitude,
        s.school_latitude,
        s.school_longitude,
        s.geofence_radius_meters,
    ):
        return RedirectResponse(
            url="/static/scan_result.html?ok=0&msg="
            + f"Vous+devez+être+à+moins+de+{int(s.geofence_radius_meters)}+m+du+cours.",
            status_code=302,
        )

    try:
        client_id, client_secret = load_oauth_client(s.google_oauth_credentials_path)
    except (FileNotFoundError, ValueError) as e:
        logger.error("OAuth non configuré: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Connexion Google non configurée (credentials.json manquant).",
        ) from e

    pending_id = create_pending_scan(session_id)
    state = sign_oauth_state(s.app_secret, pending_id)
    pub = _public_url(request)
    login_url = build_google_login_url(
        client_id,
        redirect_uri(pub),
        state,
    )
    return RedirectResponse(url=login_url, status_code=302)


@app.get("/auth/google/callback")
async def google_callback(
    request: Request,
    s: Annotated[Settings, Depends(get_settings)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    """Retour Google après connexion : enregistre la présence avec l'e-mail du compte."""
    if error:
        return RedirectResponse(
            url=f"/static/scan_result.html?ok=0&msg={error}",
            status_code=302,
        )
    if not code or not state:
        return RedirectResponse(
            url="/static/scan_result.html?ok=0&msg=Paramètres+OAuth+manquants",
            status_code=302,
        )

    pending_id = verify_oauth_state(s.app_secret, state)
    if not pending_id:
        return RedirectResponse(
            url="/static/scan_result.html?ok=0&msg=Session+expirée.+Rescannez+le+QR.",
            status_code=302,
        )

    meta = consume_pending(pending_id)
    if not meta:
        return RedirectResponse(
            url="/static/scan_result.html?ok=0&msg=Demande+déjà+utilisée+ou+expirée.",
            status_code=302,
        )

    session_id = meta["session_id"]
    if session_id not in SESSIONS:
        return RedirectResponse(
            url="/static/scan_result.html?ok=0&msg=Cours+terminé+ou+session+inconnue.",
            status_code=302,
        )

    try:
        client_id, client_secret = load_oauth_client(s.google_oauth_credentials_path)
        profile = await exchange_code_and_get_profile(
            code,
            client_id,
            client_secret,
            redirect_uri(_public_url(request)),
        )
    except ValueError as e:
        logger.exception("Callback Google")
        return RedirectResponse(
            url=f"/static/scan_result.html?ok=0&msg={str(e).replace(' ', '+')}",
            status_code=302,
        )

    email = profile.get("email") or profile.get("id") or "inconnu"
    name = profile.get("name", "")
    room = SESSIONS[session_id]["room"]
    record = {
        "session_id": session_id,
        "room": room,
        "student_id": email,
        "student_name": name,
        "email": email,
        "auth": "google",
        "at": datetime.now(timezone.utc).isoformat(),
    }
    ATTENDANCE_LOG.append(record)
    logger.info("Présence Google: %s", record)

    room_q = room.replace(" ", "+")
    return RedirectResponse(
        url=f"/static/scan_result.html?ok=1&room={room_q}",
        status_code=302,
    )


class ScanBody(BaseModel):
    token: str
    student_id: str = Field(..., description="Identifiant élève (login, e-mail école, etc.)")
    latitude: float
    longitude: float


@app.post("/api/attendance/scan")
def scan_attendance(
    body: ScanBody,
    request: Request,
    s: Annotated[Settings, Depends(get_settings)],
):
    sid_check = verify_token(s.app_secret, body.token, s.token_ttl_seconds)
    if not sid_check:
        raise HTTPException(status_code=400, detail="Jeton invalide ou expiré")

    if not inside_geofence(
        body.latitude,
        body.longitude,
        s.school_latitude,
        s.school_longitude,
        s.geofence_radius_meters,
    ):
        raise HTTPException(
            status_code=403,
            detail=f"Vous devez être à moins de {int(s.geofence_radius_meters)} m du cours.",
        )

    room = SESSIONS.get(sid_check, {}).get("room", "?")
    record = {
        "session_id": sid_check,
        "room": room,
        "student_id": body.student_id,
        "student_name": body.student_id,
        "auth": "api",
        "at": datetime.now(timezone.utc).isoformat(),
    }
    ATTENDANCE_LOG.append(record)
    logger.info("Présence enregistrée: %s", record)
    return {"ok": True, "room": room, "message": "Présence enregistrée"}


@app.get("/api/admin/attendance")
def list_attendance():
    """MVP : liste brute ; en prod, protéger par auth + rôles."""
    return list(ATTENDANCE_LOG)


@app.get("/api/sessions/{session_id}/attendance")
def session_attendance(session_id: str):
    """Présents pour une session (page professeur)."""
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session inconnue")
    return [r for r in ATTENDANCE_LOG if r.get("session_id") == session_id]


class AlertEmailBody(BaseModel):
    sender_email: str
    to_email: str
    subject: str
    body: str


@app.post("/api/notify/email")
def post_alert_email(
    body: AlertEmailBody,
    s: Annotated[Settings, Depends(get_settings)],
):
    """
    Optionnel : envoi d'une alerte (ex. absence) via Gmail API.
    Nécessite credentials.json + premier flux OAuth (voir README).
    """
    ok = send_gmail_simple(
        body.sender_email,
        body.to_email,
        body.subject,
        body.body,
        s.gmail_credentials_path,
        s.gmail_token_path,
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Envoi e-mail échoué (voir logs serveur)")
    return {"ok": True}


@app.get("/", response_class=HTMLResponse)
def root():
    return HTMLResponse(
        """<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Appel QR</title>
  <link rel="stylesheet" href="/static/css/theme.css">
</head>
<body>
  <div class="tex-layer tex-hex" aria-hidden="true"></div>
  <div class="tex-layer tex-grid" aria-hidden="true"></div>
  <div class="tex-layer tex-noise" aria-hidden="true"></div>
  <div class="tex-layer tex-vignette" aria-hidden="true"></div>
  <div class="site-wrap">
    <header class="site-header">
      <img class="site-logo" src="/static/img/logo-guardia.png" alt="Logo" width="56" height="56">
      <div class="site-header-text"><h1>Appel QR</h1><p>API de présence sécurisée</p></div>
    </header>
    <section class="panel">
      <p class="hint"><a class="btn-primary" href="/static/teacher.html">Interface professeur →</a></p>
      <p class="links" style="margin-top:1rem;"><a href="/docs">Documentation Swagger</a></p>
    </section>
  </div>
</body>
</html>"""
    )


@app.get("/api/config")
def public_config(request: Request, s: Annotated[Settings, Depends(get_settings)]):
    """Infos utiles pour la page prof (URL à mettre dans PUBLIC_BASE_URL)."""
    return {
        "public_base_url": request.app.state.public_base_url,
        "scan_flow": "QR → /scan → Google OAuth → présence",
        "mode": "online_only",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
