"""Configuration chargée depuis l'environnement (fichier .env en dev)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_secret: str = "dev-secret-change-in-production"
    school_latitude: float = 48.8566
    school_longitude: float = 2.3522
    geofence_radius_meters: float = 50.0
    # Liste vide = pas de contrôle IP (pratique en développement local)
    allowed_public_ips: str = ""
    token_ttl_seconds: int = 30
    qr_refresh_seconds: int = 5

    # URL accessible depuis le téléphone (Wi‑Fi) — pas 127.0.0.1 si scan depuis mobile
    # Ex. http://192.168.1.42:8765 (ipconfig sur le PC)
    public_base_url: str = "http://127.0.0.1:8765"

    google_oauth_credentials_path: str = "credentials.json"
    gmail_credentials_path: str = "credentials.json"
    gmail_token_path: str = "gmail_token.json"

    def allowed_ip_set(self) -> set[str]:
        raw = self.allowed_public_ips.strip()
        if not raw:
            return set()
        return {p.strip() for p in raw.split(",") if p.strip()}


settings = Settings()
