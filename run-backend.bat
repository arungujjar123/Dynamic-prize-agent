@echo off
echo ========================================================
echo   Starting Dynamic Pricing Agent FastAPI Backend
echo ========================================================
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
    echo Using virtual environment .venv...
    .venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
) else (
    python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
)

pause
