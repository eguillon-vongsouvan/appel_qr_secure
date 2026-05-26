"""Jetons éphémères pour QR dynamique (HMAC + horodatage)."""

import base64
import hashlib
import hmac
import json
import time
from typing import Any


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def mint_token(secret: str, session_id: str, ttl_seconds: int) -> str:
    """Génère un jeton signé valide ~ttl_seconds (le serveur accepte un léger décalage d'horloge)."""
    now = int(time.time())
    payload: dict[str, Any] = {"sid": session_id, "iat": now, "exp": now + ttl_seconds}
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
    return f"{_b64url_encode(body)}.{_b64url_encode(sig)}"


def verify_token(secret: str, token: str, max_age_seconds: int, skew_seconds: int = 5) -> str | None:
    """
    Retourne session_id si valide, sinon None.
    max_age_seconds : âge maximal depuis iat côté client (aligné TTL affichage QR).
    """
    try:
        body_b64, sig_b64 = token.split(".", 1)
        body = _b64url_decode(body_b64)
        sig = _b64url_decode(sig_b64)
        expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(body.decode("utf-8"))
        session_id = data.get("sid")
        iat = int(data.get("iat", 0))
        if not session_id:
            return None
        now = int(time.time())
        if now < iat - skew_seconds:
            return None
        if now > iat + max_age_seconds + skew_seconds:
            return None
        return str(session_id)
    except (ValueError, KeyError, json.JSONDecodeError, TypeError):
        return None
