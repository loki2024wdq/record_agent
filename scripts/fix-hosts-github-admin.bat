@echo off
setlocal

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Please right-click this file and choose "Run as administrator".
  pause
  exit /b 1
)

set "HOSTS=%SystemRoot%\System32\drivers\etc\hosts"
set "BACKUP=%SystemRoot%\System32\drivers\etc\hosts.codex-backup-%date:~0,4%%date:~5,2%%date:~8,2%-%time:~0,2%%time:~3,2%%time:~6,2%"
set "BACKUP=%BACKUP: =0%"

copy "%HOSTS%" "%BACKUP%" >nul
if not "%errorlevel%"=="0" (
  echo Failed to back up hosts file.
  pause
  exit /b 1
)

> "%HOSTS%" echo # Default local host entries
>> "%HOSTS%" echo 127.0.0.1 localhost
>> "%HOSTS%" echo ::1 localhost
>> "%HOSTS%" echo.
>> "%HOSTS%" echo # GitHub temporary 202606
>> "%HOSTS%" echo 140.82.112.4 github.com
>> "%HOSTS%" echo 185.199.108.154 github.global.ssl.fastly.net
>> "%HOSTS%" echo 199.232.69.194 codeload.github.com

ipconfig /flushdns

echo.
echo Hosts file updated.
echo Backup saved to:
echo %BACKUP%
echo.
echo Test with:
echo ping github.com
echo.
pause
