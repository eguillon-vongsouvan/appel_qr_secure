@echo off
cd /d "%~dp0"
echo === Emargement QR ===
echo.
echo 1. Arret de l ancien serveur...
call npm run stop 2>nul
echo.
echo 2. Demarrage...
start "" "http://localhost:3000/affiche"
npm start
