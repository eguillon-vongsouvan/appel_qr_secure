"""Configuration chargée depuis l'environnement (fichier .env en dev)."""

import os
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict


def _is_local_host(host: str | None) -> bool:
    if not host:
        return True
    h = host.lower()
    if h in ("localhost", "127.0.0.1", "::1"):
        return True
    if h.startswith("192.168.") or h.startswith("10."):
        return True
    if h.startswith("172."):
        parts = h.split(".")
        if len(parts) >= 2:
            try:
                second = int(parts[1])
                if 16 <= second <= 31:
                    return True
            except ValueError:
                pass
    return False


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_secret: str = "dev-secret-change-in-production"
    school_latitude: float = 48.8566
    school_longitude: float = 2.3522
    geofence_radius_meters: float = 200.0
    allowed_public_ips: str = ""
    token_ttl_seconds: int = 30
    qr_refresh_seconds: int = 5

    # URL HTTPS publique obligatoire (Render, ngrok, domaine perso)
    public_base_url: str = ""

    google_oauth_credentials_path: str = "credentials.json"
    gmail_credentials_path: str = "credentials.json"
    gmail_token_path: str = "gmail_token.json"

    def allowed_ip_set(self) -> set[str]:
        raw = self.allowed_public_ips.strip()
        if not raw:
            return set()
        return {p.strip() for p in raw.split(",") if p.strip()}

    def resolved_public_base_url(self) -> str:
        """URL Internet pour les QR et OAuth (pas de localhost / IP privée)."""
        raw = (
            os.environ.get("RENDER_EXTERNAL_URL", "").strip()
            or os.environ.get("PUBLIC_URL", "").strip()
            or self.public_base_url.strip()
        ).rstrip("/")
        if not raw:
            raise ValueError(
                "PUBLIC_BASE_URL obligatoire dans .env (URL HTTPS publique, ex. "
                "https://votre-app.onrender.com ou URL ngrok)."
            )
        host = urlparse(raw).hostname
        if _is_local_host(host):
            raise ValueError(
                f"URL locale interdite ({host}). Définissez une URL Internet accessible "
                "depuis n'importe où (Render, ngrok, etc.)."
            )
        return raw


settings = Settings()
