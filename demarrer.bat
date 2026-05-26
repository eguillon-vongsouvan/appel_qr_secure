@echo off
cd /d "%~dp0"
echo === Emargement QR (mode en ligne) ===
echo.

if not exist ".env" (
  echo ERREUR : fichier .env manquant.
  echo Copiez .env.example vers .env et definissez PUBLIC_URL=https://...
  echo.
  pause
  exit /b 1
)

findstr /B /C:"PUBLIC_URL=" .env >nul 2>&1
if errorlevel 1 (
  echo ERREUR : ajoutez PUBLIC_URL=https://votre-url-publique dans .env
  echo Voir scripts\tunnel-ngrok.ps1 pour un tunnel ngrok.
  pause
  exit /b 1
)

echo Arret de l ancien serveur...
call npm run stop 2>nul
echo.
echo Demarrage (les QR utilisent PUBLIC_URL du fichier .env)...
echo.
npm start
