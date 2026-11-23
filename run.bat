@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo     MEMULAI SERVER WARGAOPOLY 62 (LOCAL SERVER)
echo ===================================================

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Menggunakan runtime Node.js sistem...
    node server.js
) else (
    echo Menggunakan runtime bawaan Antigravity IDE...
    set ELECTRON_RUN_AS_NODE=1
    "%LOCALAPPDATA%\Programs\Antigravity IDE\Antigravity IDE.exe" server.js
)

pause
