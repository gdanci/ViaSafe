# ViaSafe: download the Cluj-Napoca neighbourhood (cartiere) positions from OpenStreetMap.
# Run from PowerShell, in this folder:   powershell -ExecutionPolicy Bypass -File .\get-cartiere.ps1

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

$outDir = Join-Path $PSScriptRoot "data\raw"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$out   = Join-Path $outDir "cartiere-osm.json"
$qfile = Join-Path $outDir "cartiere-query.txt"

$q = '[out:json][timeout:60];(nwr["place"~"^(suburb|neighbourhood|quarter)$"](46.70,23.45,46.85,23.78););out tags center bb;'
Set-Content -Path $qfile -Value $q -Encoding ascii

Write-Host "Downloading the neighbourhoods of Cluj-Napoca..." -ForegroundColor Cyan
curl.exe -sS --fail -A "ViaSafe-hackathon/1.0" --data-urlencode "data@$qfile" -o $out "https://overpass-api.de/api/interpreter"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Download failed. If it says too many requests, wait a minute and run this again." -ForegroundColor Red
  exit 1
}
Remove-Item $qfile -Force -ErrorAction SilentlyContinue

$size = [math]::Round((Get-Item $out).Length / 1KB, 1)
Write-Host "Saved $out ($size KB)" -ForegroundColor Green
Write-Host "Tell Claude it is done."
