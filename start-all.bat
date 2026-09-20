@echo off
setlocal

echo ================================================
echo   Skovio OTP Auth - Full Setup ^& Launch Script
echo ================================================
echo.

REM ---- Locate this script's own folder (must sit inside skovio-otp-auth/) ----
cd /d "%~dp0"

REM ---- BACKEND SETUP ----
echo [1/6] Installing backend dependencies...
cd backend
call npm install
if errorlevel 1 (
    echo.
    echo ERROR: backend npm install failed. Fix the error above and re-run this script.
    pause
    exit /b 1
)

if not exist ".env" (
    echo [2/6] Creating backend\.env from .env.example ...
    copy ".env.example" ".env" >nul
    echo.
    echo ================================================
    echo   ACTION NEEDED: Open backend\.env now and fill in:
    echo     - DB_HOST / DB_USER / DB_PASSWORD / DB_NAME
    echo     - JWT_SECRET  (any long random string)
    echo     - SMTP_USER / SMTP_PASS  (Gmail address + App Password)
    echo ================================================
    echo.
    notepad ".env"
) else (
    echo [2/6] backend\.env already exists, skipping creation.
)

cd ..

REM ---- FRONTEND SETUP ----
echo [3/6] Installing frontend dependencies...
cd frontend
call npm install
if errorlevel 1 (
    echo.
    echo ERROR: frontend npm install failed. Fix the error above and re-run this script.
    pause
    exit /b 1
)

if not exist ".env" (
    echo [4/6] Creating frontend\.env from .env.example ...
    copy ".env.example" ".env" >nul
) else (
    echo [4/6] frontend\.env already exists, skipping creation.
)

cd ..

REM ---- DATABASE REMINDER ----
echo.
echo [5/6] Make sure your MySQL database is created before continuing.
echo        If you have not run it yet, open a NEW terminal and run:
echo        mysql -u root -p ^< backend\db.sql
echo.
pause

REM ---- LAUNCH BOTH SERVERS ----
echo [6/6] Starting backend and frontend in separate windows...

start "Skovio Backend"  cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak >nul
start "Skovio Frontend" cmd /k "cd frontend && npm run dev"

timeout /t 5 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo ================================================
echo   All set. Two terminal windows are now running:
echo     - Skovio Backend  (http://localhost:5000)
echo     - Skovio Frontend (http://localhost:5173)
echo   Your browser should open the app automatically.
echo   Close those terminal windows to stop the servers.
echo ================================================
pause
