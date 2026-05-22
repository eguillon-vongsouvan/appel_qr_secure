# Application d’appel sécurisée par QR (MVP Python)

Implémentation inspirée du guide *Application d’Appel Sécurisée* : jeton éphémère dans le QR, vérification GPS (géofence), filtrage par IP publique du Wi‑Fi école, page web pour le professeur, et **option** d’alertes via **Gmail API** avec OAuth utilisateur (pas de compte administrateur Google Workspace requis pour envoyer depuis votre propre adresse après consentement).

## Sans droits administrateur sur la machine

- Utilisez un **venv** dans votre dossier utilisateur (aucune installation globale).
- `pip` installe les paquets dans le venv uniquement.
- Pas besoin d’installer PostgreSQL pour ce MVP : tout est en mémoire ; en production, remplacez par PostgreSQL comme dans le guide.

```powershell
cd chemin\vers\appel_qr_secure
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# Éditez .env : coordonnées école, rayon, secret, IPs autorisées
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8765
```

Ou double-cliquez sur `run_server.bat` (port **8765** par défaut).

Ouvrez : [http://127.0.0.1:8765/docs](http://127.0.0.1:8765/docs).

### Erreur `[WinError 10013]` sur le port 8000

Souvent le port **8000 est réservé par Windows** (Hyper-V, Docker, WSL). Ce n’est pas lié à l’avertissement pip.

- Utilisez un autre port, par ex. **8765** :  
  `.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8765`
- Pour voir les plages bloquées :  
  `netsh interface ipv4 show excludedportrange protocol=tcp`
- Si ça échoue encore, testez sans rechargement auto :  
  `.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8765`

## Configuration importante

| Variable | Rôle |
|----------|------|
| `APP_SECRET` | Clé pour signer les jetons QR (à garder secrète). |
| `SCHOOL_LATITUDE` / `SCHOOL_LONGITUDE` | Centre du périmètre. |
| `GEOFENCE_RADIUS_METERS` | Ex. 50 m. |
| `ALLOWED_PUBLIC_IPS` | IP(s) publique(s) du Wi‑Fi école, séparées par des virgules. **Vide = désactivé** (pratique en local). |
| `TOKEN_TTL_SECONDS` | Durée de validité du jeton (ex. 30). |
| `PUBLIC_BASE_URL` | URL du serveur **vue par le téléphone** (ex. `http://192.168.1.25:8765`). Obligatoire pour le scan QR → Google. |

Pour connaître l’IP publique vue depuis Internet depuis le réseau école : recherchez « what is my ip » depuis un poste connecté au **Wi‑Fi établissement** (pas la 4G).

## Déroulé professeur

1. `POST /api/sessions` avec `{ "room_name": "Salle A104" }`.
2. Réponse : `session_id` et `teacher_url`.
3. Ouvrir `http://127.0.0.1:8765/static/teacher.html?session=<session_id>` sur le vidéoprojecteur (ou utiliser l’URL renvoyée en adaptant le host).

Le QR se régénère automatiquement pour limiter le partage de captures.

## Déroulé élève — scan → connexion Google

1. Le QR contient une **URL** du type :  
   `http://192.168.x.x:8765/scan?t=<jeton>`
2. Le téléphone ouvre cette page → redirection vers **accounts.google.com** (connexion Google).
3. Après connexion, la présence est enregistrée avec l’**e-mail Google** du compte.

### Configurer Google OAuth (sans admin Workspace)

1. [Google Cloud Console](https://console.cloud.google.com/) : projet perso, activer l’écran de consentement OAuth (externe, vous en testeur).
2. Créer des identifiants **Application Web** (recommandé) → télécharger `credentials.json`.
3. **URI de redirection autorisées** (adapter l’IP de votre PC avec `ipconfig`) :
   - `http://192.168.1.25:8765/auth/google/callback`
   - (optionnel en local) `http://127.0.0.1:8765/auth/google/callback`
4. Dans `.env` : `PUBLIC_BASE_URL=http://192.168.1.25:8765` (même IP/port que ci-dessus).
5. Lancer le serveur en écoutant toutes les interfaces :  
   `uvicorn app.main:app --host 0.0.0.0 --port 8765`  
   (`run_server.bat` le fait déjà.)
6. Téléphone et PC sur le **même Wi‑Fi** ; pare-feu Windows : autoriser le port **8765** entrant.

Test depuis le PC : ouvrir l’URL affichée par `GET /api/sessions/{id}/qr-url` dans le navigateur du téléphone.

### API manuelle (sans Google, dev)

`POST /api/attendance/scan` avec jeton + GPS reste disponible pour les tests.

## Gmail API (optionnel, sans admin domaine)

Adapté pour envoyer des mails **depuis votre compte** après votre consentement OAuth.

1. [Google Cloud Console](https://console.cloud.google.com/) : créer un projet **perso**, activer **Gmail API**.
2. Écran de consentement OAuth : type « Externe », vous comme **utilisateur test**.
3. Créer des identifiants **Application de bureau** → télécharger `credentials.json` dans le dossier `appel_qr_secure`.
4. Dans `.env`, renseignez `GMAIL_CREDENTIALS_PATH` et `GMAIL_TOKEN_PATH`.
5. Premier appel à `POST /api/notify/email` ou exécution du flux OAuth ouvrira le navigateur et créera `gmail_token.json` **dans votre profil utilisateur** (pas besoin d’être admin Windows).

L’envoi « au nom de l’organisation » sans interaction sur un domaine Workspace impose en général la **délégation domain-wide** (admin Google) : ce MVP utilise le chemin **compte utilisateur**.

## Limites MVP / RGPD

- **Géolocalisation** : lue seulement au moment du `POST /scan` côté conception recommandée ; ce serveur ne stocke pas les coordonnées dans le journal MVP (seulement salle, élève, IP).
- **Fake GPS** : la détection poussée se fait plutôt **côté application mobile** (intégrité app, capteurs) ; le backend seul ne suffit pas.

## Structure

- `app/main.py` — API FastAPI, sessions en mémoire.
- `app/tokens.py` — jeton HMAC + horodatage.
- `app/geo.py` — haversine / géofence.
- `app/gmail_notify.py` — envoi optionnel Gmail.
- `static/teacher.html` — affichage du QR dynamique.
