# ViaSafe: rebuild the backend + website and run it in the background.
# Run from PowerShell, in this folder:   powershell -ExecutionPolicy Bypass -File .\rebuild-and-run.ps1

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Cyan }

Step "Checking that Docker is running"
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker is not running. Open Docker Desktop, wait for 'Engine running', then run this script again." -ForegroundColor Red
  exit 1
}

Step "Making sure the routing server is running"
docker start valhalla *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "No routing server found. Routes won't work until you run setup-valhalla.ps1." -ForegroundColor Yellow
}

Step "Building ViaSafe"
docker build -t viasafe-backend .
if ($LASTEXITCODE -ne 0) { Write-Host "The build failed. See the message above." -ForegroundColor Red; exit 1 }

Step "Starting ViaSafe on port 8080"
docker rm -f viasafe *> $null
docker run -d --name viasafe --restart unless-stopped -p 8080:3000 --env-file .env viasafe-backend
if ($LASTEXITCODE -ne 0) {
  Write-Host "Could not start. If port 8080 is busy, close the window where the old ViaSafe is running (Ctrl+C) and try again." -ForegroundColor Red
  exit 1
}

Start-Sleep -Seconds 4
Write-Host ""
Write-Host "ViaSafe is running: http://localhost:8080" -ForegroundColor Green
Write-Host "  See the log:  docker logs --tail 30 viasafe"
Write-Host "  Stop it:      docker stop viasafe"
