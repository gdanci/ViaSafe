# ViaSafe: set up the Cluj-Napoca routing server (Valhalla) in Docker.
# Run from PowerShell, in this folder:   .\setup-valhalla.ps1
# Takes about 10-30 minutes the first time (it downloads the Romania map once, then cuts out Cluj).

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$backend = $PSScriptRoot
$data    = Join-Path (Split-Path $backend -Parent) "valhalla\custom_files"
$romania = Join-Path $data "romania-latest.osm.pbf"
$cluj    = Join-Path $data "cluj.osm.pbf"

function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Cyan }

Step "Checking that Docker is running"
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker is not running. Open Docker Desktop, wait for 'Engine running', then run this script again." -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force -Path $data | Out-Null

if (-not (Test-Path $cluj)) {
  if (-not (Test-Path $romania)) {
    Step "Downloading the Romania map (one time, a few hundred MB)"
    curl.exe -L --fail -o $romania "https://download.geofabrik.de/europe/romania-latest.osm.pbf"
    if ($LASTEXITCODE -ne 0) { Write-Host "Download failed. Check your internet connection and run the script again." -ForegroundColor Red; exit 1 }
  }

  Step "Cutting out Cluj-Napoca"
  docker run --rm -v "${data}:/data" iboates/osmium:latest extract -b 23.40,46.68,23.80,46.87 /data/romania-latest.osm.pbf -o /data/cluj.osm.pbf --overwrite
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $cluj)) { Write-Host "Could not cut out Cluj. See the message above." -ForegroundColor Red; exit 1 }
}

# Valhalla builds from every .pbf in the folder, so the big Romania file must go.
if (Test-Path $romania) { Remove-Item $romania -Force }

Step "Starting the routing server (the first start builds the routes, please wait)"
docker rm -f valhalla *> $null
docker run -dt --name valhalla --restart unless-stopped -p 8002:8002 -v "${data}:/custom_files" ghcr.io/nilsnolde/docker-valhalla/valhalla:latest
if ($LASTEXITCODE -ne 0) { Write-Host "Could not start Valhalla. See the message above." -ForegroundColor Red; exit 1 }

Step "Pointing the backend at it (.env)"
$envFile = Join-Path $backend ".env"
$line = "VALHALLA_URL=http://host.docker.internal:8002"
if (Test-Path $envFile) {
  $text = Get-Content $envFile
  if ($text -match "^VALHALLA_URL=") { $text = $text -replace "^VALHALLA_URL=.*", $line } else { $text += $line }
  Set-Content -Path $envFile -Value $text -Encoding ascii
  Write-Host "Updated $envFile"
} else {
  Write-Host "No .env found. Add this line yourself: $line" -ForegroundColor Yellow
}

Step "Waiting for the routing server to be ready (up to 30 minutes)"
$ready = $false
for ($i = 0; $i -lt 180; $i++) {
  try {
    $r = Invoke-RestMethod -Uri "http://localhost:8002/status" -TimeoutSec 5
    if ($r) { $ready = $true; break }
  } catch { }
  Start-Sleep -Seconds 10
  if ($i % 6 -eq 5) { Write-Host "  still building... ($([int](($i+1)/6)) min)" }
}

if ($ready) {
  Write-Host ""
  Write-Host "Routing server is ready." -ForegroundColor Green
  Write-Host "Now restart the backend:"
  Write-Host "  docker build -t viasafe-backend ."
  Write-Host "  docker run -p 8080:3000 --env-file .env viasafe-backend"
  Write-Host "Then open http://localhost:8080 and try the Route tab."
} else {
  Write-Host ""
  Write-Host "Not ready yet. Check progress with:  docker logs --tail 30 valhalla" -ForegroundColor Yellow
  Write-Host "When http://localhost:8002/status shows JSON, restart the backend as above."
}
