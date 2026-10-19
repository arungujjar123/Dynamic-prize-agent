@echo off
echo ========================================================
echo   Launching Dynamic Pricing Agent System (All-in-One)
echo ========================================================

echo 1. Starting FastAPI Backend on http://localhost:8000 ...
start "TMLCStore Backend (FastAPI)" cmd /k "cd /d %~dp0 && call run-backend.bat"

echo 2. Starting React Dashboard on http://localhost:3000 ...
start "TMLCStore React Frontend" cmd /k "cd /d %~dp0 && call run-react.bat"

echo.
echo Both servers have been launched in separate terminal windows!
echo - React Frontend:  http://localhost:3000
echo - FastAPI Backend: http://localhost:8000
echo - Swagger Docs:    http://localhost:8000/docs
echo.
pause
