@echo off
title HostelBuddy Server
echo.
echo  =============================================
echo   HostelBuddy - Expense Tracker
echo  =============================================
echo.
echo  Starting server...
cd /d "%~dp0"

:: Check if node is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js is not installed.
    echo  Download it from https://nodejs.org
    pause
    exit /b 1
)

:: Install dependencies if node_modules missing
if not exist "node_modules" (
    echo  Installing dependencies...
    npm install
)

echo  Server running at http://localhost:3000
echo  Opening browser...
echo.
echo  Press Ctrl+C to stop the server.
echo.

:: Open browser after short delay
start "" timeout /t 2 >nul && start http://localhost:3000

:: Start the server
node server.js
pause
