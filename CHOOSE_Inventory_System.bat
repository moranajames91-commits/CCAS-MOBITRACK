@echo off
echo Starting CCAS MOBITRACK...
echo Opening browser at http://localhost:3000
cd /d "%~dp0"
echo Starting dual-drive backup and recovery engine...
start "CCAS Dual-Drive Engine" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ccas_dual_drive_engine.ps1" -Mode Monitor -SourceRoot "%~dp0" -BackupRoot "D:\CCAS_SYSTEM_BACKUPS"
start "" http://localhost:3000
start /min cmd /c "npm run dev"
exit