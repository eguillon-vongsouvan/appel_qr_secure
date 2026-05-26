@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Creation du venv et installation des dependances...
  python -m venv .venv
  call .venv\Scripts\activate.bat
  python -m pip install -r requirements.txt
)
REM Port 8000 souvent bloque sur Windows (Hyper-V / plages reservees) -> 8765
set PORT=8765
echo Demarrage du serveur sur http://127.0.0.1:%PORT%
REM 0.0.0.0 pour que le telephone sur le meme Wi-Fi puisse joindre le PC
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port %PORT%
pause
