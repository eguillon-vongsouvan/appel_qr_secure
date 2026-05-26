"""Connexion Google (OAuth2) déclenchée par le scan du QR code."""

from __future__ import annotations

import json
import logging
import secrets
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import httpx

from app.tokens import _b64url_decode, _b64url_encode

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
OAUTH_SCOPES = "openid email profile"

# Scans en cours (pending_id -> métadonnées), TTL court pour finir la connexion Google
PENDING_SCANS: dict[str, dict[str, Any]] = {}
PENDING_TTL_SECONDS = 180


def load_oauth_client(credentials_path: str) -> tuple[str, str]:
    path = Path(credentials_path)
    if not path.is_file():
        raise FileNotFoundError(
            f"Fichier OAuth introuvable : {credentials_path}. "
            "Téléchargez credentials.json depuis Google Cloud Console."
        )
    data = json.loads(path.read_text(encoding="utf-8"))
    block = data.get("web") or data.get("installed")
    if not block:
        raise ValueError("credentials.json doit contenir une clé 'web' ou 'installed'.")
    client_id = block.get("client_id")
    client_secret = block.get("client_secret", "")
    if not client_id:
        raise ValueError("client_id manquant dans credentials.json")
    return client_id, client_secret


def redirect_uri(public_base_url: str) -> str:
    return f"{public_base_url.rstrip('/')}/auth/google/callback"


def qr_scan_url(public_base_url: str, token: str) -> str:
    """URL encodée dans le QR : ouvre le navigateur du téléphone puis Google."""
    return f"{public_base_url.rstrip('/')}/scan?t={token}"


def create_pending_scan(session_id: str) -> str:
    pending_id = str(uuid.uuid4())
    PENDING_SCANS[pending_id] = {
        "session_id": session_id,
        "created_at": int(time.time()),
        "used": False,
    }
    _purge_expired_pending()
    return pending_id


def _purge_expired_pending() -> None:
    now = int(time.time())
    expired = [
        pid
        for pid, meta in PENDING_SCANS.items()
        if now - int(meta.get("created_at", 0)) > PENDING_TTL_SECONDS
    ]
    for pid in expired:
        PENDING_SCANS.pop(pid, None)


def sign_oauth_state(secret: str, pending_id: str) -> str:
    import hashlib
    import hmac

    nonce = secrets.token_urlsafe(8)
    payload = {"pid": pending_id, "n": nonce, "iat": int(time.time())}
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
    return f"{_b64url_encode(body)}.{_b64url_encode(sig)}"


def verify_oauth_state(secret: str, state: str) -> str | None:
    import hashlib
    import hmac

    try:
        body_b64, sig_b64 = state.split(".", 1)
        body = _b64url_decode(body_b64)
        sig = _b64url_decode(sig_b64)
        expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(body.decode("utf-8"))
        pending_id = data.get("pid")
        iat = int(data.get("iat", 0))
        if not pending_id or int(time.time()) - iat > PENDING_TTL_SECONDS:
            return None
        return str(pending_id)
    except (ValueError, json.JSONDecodeError, TypeError):
        return None


def consume_pending(pending_id: str) -> dict[str, Any] | None:
    _purge_expired_pending()
    meta = PENDING_SCANS.get(pending_id)
    if not meta or meta.get("used"):
        return None
    meta["used"] = True
    return meta


def build_google_login_url(
    client_id: str,
    redirect_uri_value: str,
    state: str,
) -> str:
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri_value,
        "response_type": "code",
        "scope": OAUTH_SCOPES,
        "access_type": "online",
        "prompt": "select_account",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code_and_get_profile(
    code: str,
    client_id: str,
    client_secret: str,
    redirect_uri_value: str,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri_value,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            logger.error("Token Google: %s", token_resp.text)
            raise ValueError("Échange du code OAuth refusé par Google.")
        access_token = token_resp.json().get("access_token")
        if not access_token:
            raise ValueError("Pas de jeton d'accès dans la réponse Google.")

        user_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if user_resp.status_code != 200:
            raise ValueError("Impossible de récupérer le profil Google.")
        return user_resp.json()
