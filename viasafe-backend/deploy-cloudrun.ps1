# ViaSafe: put the website + API + routing online on Google Cloud Run.
# Run from PowerShell, in this folder:   .\deploy-cloudrun.ps1
# Needs: the Google Cloud CLI (gcloud), Docker running, and your local "valhalla" container (from setup-valhalla.ps1).
# Safe to run again later: it simply deploys the newest version.

param(
  [string]$Project = "viasfae-4bd46",
  [string]$Region  = "europe-west1"
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
$backend = $PSScriptRoot

function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Cyan }
function Fail($text) { Write-Host $text -ForegroundColor Red; exit 1 }

Step "Checking the Google Cloud CLI"
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  Fail "gcloud is not installed. Install it with:  winget install Google.CloudSDK   (then open a NEW PowerShell window and run this script again)."
}

Step "Checking that you are signed in to Google Cloud"
$account = (gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null)
if (-not $account) {
  Write-Host "A browser window will open. Sign in with the Google account that owns the Firebase project."
  gcloud auth login
  $account = (gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null)
  if (-not $account) { Fail "Not signed in." }
}
Write-Host "Signed in as $account"
gcloud config set project $Project *> $null

Step "Checking billing (Cloud Run needs a billing account linked; the free allowance usually covers a demo)"
$billing = (gcloud billing projects describe $Project --format="value(billingEnabled)" 2>$null)
if ($billing -ne "True") {
  Write-Host "Billing is not enabled for project $Project." -ForegroundColor Yellow
  Write-Host "Open https://console.cloud.google.com/billing/linkedaccount?project=$Project , link a billing account, then run this script again."
  exit 1
}

Step "Turning on the Google services we need (first time only, can take a minute)"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com --quiet
if ($LASTEXITCODE -ne 0) { Fail "Could not enable the services. See the message above." }

# ---------- 1. Routing server (private) ----------
Step "Copying the Cluj map tiles out of your local routing container"
docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail "Docker is not running. Open Docker Desktop and run this script again." }
$ctx = Join-Path $backend "deploy\valhalla\custom_files"
if (Test-Path $ctx) { Remove-Item $ctx -Recurse -Force }
New-Item -ItemType Directory -Force -Path $ctx | Out-Null
docker cp valhalla:/custom_files/. $ctx
if ($LASTEXITCODE -ne 0) { Fail "Could not copy from the 'valhalla' container. Run .\setup-valhalla.ps1 first and wait until it says the routing server is ready." }
Get-ChildItem $ctx -Recurse -Filter *.pbf -ErrorAction SilentlyContinue | Remove-Item -Force
if (-not (Test-Path (Join-Path $ctx "valhalla.json"))) { Fail "valhalla.json is missing in the copied files. Make sure the routing server finished building locally." }
$mb = [int]((Get-ChildItem $ctx -Recurse -File | Measure-Object Length -Sum).Sum / 1MB)
Write-Host "Copied $mb MB of map data."

Step "Deploying the routing server (private, only the ViaSafe API may call it)"
gcloud run deploy viasafe-valhalla --source (Join-Path $backend "deploy\valhalla") --region $Region --port 8002 `
  --memory 1Gi --cpu 1 --cpu-boost --min-instances 0 --max-instances 2 --timeout 60 `
  --no-allow-unauthenticated --quiet
if ($LASTEXITCODE -ne 0) { Fail "Deploying the routing server failed. See the message above." }
$valhallaUrl = (gcloud run services describe viasafe-valhalla --region $Region --format="value(status.url)")
Write-Host "Routing server: $valhallaUrl"

# ---------- 2. Let the API call it ----------
Step "Allowing the ViaSafe API to call the routing server"
$projectNumber = (gcloud projects describe $Project --format="value(projectNumber)")
$runtimeSa = "$projectNumber-compute@developer.gserviceaccount.com"
gcloud run services add-iam-policy-binding viasafe-valhalla --region $Region --member="serviceAccount:$runtimeSa" --role="roles/run.invoker" --quiet *> $null
gcloud projects add-iam-policy-binding $Project --member="serviceAccount:$runtimeSa" --role="roles/datastore.user" --quiet *> $null

# ---------- 3. Website + API (public) ----------
Step "Preparing the website + API (your secret key and .env are NOT included)"
$stage = Join-Path $env:TEMP "viasafe-deploy"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
robocopy $backend $stage /E /XD node_modules dist secrets .git deploy /XF .env .env.* *.ps1 | Out-Null
if ($LASTEXITCODE -ge 8) { Fail "Could not prepare the files to upload." }

Step "Deploying the website + API (takes a few minutes)"
$vars = "ENABLE_PRIVATE_API=false,ALLOW_RESET=false,SEED_DEMO_DATA=false,CLUJ_ONLY=true,STORAGE_DRIVER=local,VALHALLA_URL=$valhallaUrl,VALHALLA_AUDIENCE=$valhallaUrl"
gcloud run deploy viasafe --source $stage --region $Region --allow-unauthenticated `
  --memory 512Mi --cpu 1 --min-instances 0 --max-instances 3 --timeout 60 `
  --set-env-vars $vars --quiet
if ($LASTEXITCODE -ne 0) { Fail "Deploying the website failed. See the message above." }
$siteUrl = (gcloud run services describe viasafe --region $Region --format="value(status.url)")

Write-Host ""
Write-Host "ViaSafe is online:  $siteUrl" -ForegroundColor Green
Write-Host "The first visit after a quiet period can take a few seconds to wake up."
Write-Host "Tip: set a budget alert so you are never surprised: https://console.cloud.google.com/billing/budgets?project=$Project"
