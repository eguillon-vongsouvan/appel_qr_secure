@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Creation du venv et installation des dependances...
  python -m venv .venv
  call .venv\Scripts\activate.bat
  python -m pip install -r requirements.txt
)

if not exist ".env" (
  echo ERREUR : copiez .env.example vers .env
  echo Definissez PUBLIC_BASE_URL=https://votre-url-publique
  pause
  exit /b 1
)

set PORT=8765
echo Demarrage API Python — mode en ligne uniquement
echo PUBLIC_BASE_URL doit etre une URL Internet dans .env
echo.
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port %PORT%
pause
