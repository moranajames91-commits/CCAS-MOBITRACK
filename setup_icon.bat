@echo off
echo =========================================
echo Creating App Icon for CCAS MOBITRACK...
echo =========================================
echo.

PowerShell -ExecutionPolicy Bypass -File "%~dp0create_shortcut.ps1"

echo.
echo Done! Check your Desktop for the new shortcut.
pause