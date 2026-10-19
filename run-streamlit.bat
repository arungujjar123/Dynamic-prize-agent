@echo off
echo ========================================================
echo   Starting Streamlit Pricing Frontend
echo ========================================================
cd /d "%~dp0"
streamlit run frontend/app.py --server.port=8501
pause
