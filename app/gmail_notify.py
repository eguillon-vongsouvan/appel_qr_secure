"""
Notifications Gmail optionnelles (OAuth2 « compte utilisateur »).

Sans droits admin : vous créez un projet Google Cloud personnel, activez l'API Gmail,
ajoutez l'écran de consentement en mode « test » et vous vous ajoutez comme testeur.

Premier lancement : exécuter le script une fois pour ouvrir le navigateur et créer gmail_token.json.

Si votre école utilise Google Workspace, l'admin n'est pas requis pour envoyer
depuis VOTRE boîte avec votre consentement ; pour envoyer au nom de l'établissement
sans interaction, il faudrait la délégation domain-wide (admin).
"""

from __future__ import annotations

import base64
import logging
from email.mime.text import MIMEText
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

logger = logging.getLogger(__name__)


def _get_service(credentials_path: str, token_path: str):
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    scopes = ["https://www.googleapis.com/auth/gmail.send"]
    creds: Credentials | None = None
    token_file = Path(token_path)
    if token_file.is_file():
        creds = Credentials.from_authorized_user_file(str(token_file), scopes)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            from google.auth.transport.requests import Request

            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(credentials_path, scopes)
            creds = flow.run_local_server(port=0)
        token_file.write_text(creds.to_json(), encoding="utf-8")
    return build("gmail", "v1", credentials=creds)


def send_gmail_simple(
    sender_email: str,
    to_email: str,
    subject: str,
    body_text: str,
    credentials_path: str,
    token_path: str,
) -> bool:
    """Envoie un e-mail texte brut via Gmail API. Retourne True si envoyé."""
    try:
        service = _get_service(credentials_path, token_path)
        msg = MIMEText(body_text, "plain", "utf-8")
        msg["to"] = to_email
        msg["from"] = sender_email
        msg["subject"] = subject
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")
        service.users().messages().send(userId="me", body={"raw": raw}).execute()
        return True
    except Exception:
        logger.exception("Échec envoi Gmail")
        return False
