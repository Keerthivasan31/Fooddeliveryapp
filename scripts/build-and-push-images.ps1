param(
  [string]$Region = "ap-south-1",
  [string]$Domain = "fooddeliveryapp.com",
  [string]$GoogleMapsApiKey = $env:GOOGLE_MAPS_API_KEY
)

$ErrorActionPreference = "Stop"

# ============================================================
# Validate parameters
# ============================================================

if ([string]::IsNullOrWhiteSpace($Region)) {
  throw "AWS Region is empty. Pass -Region ap-south-1."
}

if ([string]::IsNullOrWhiteSpace($Domain)) {
  throw "Domain is empty. Pass -Domain myfooddeliveryproject.work.gd."
}

$Domain = $Domain.Trim().TrimEnd(".")

# ============================================================
# Confirm Docker Desktop is running
# ============================================================

$PreviousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"

docker info *> $null
$DockerExitCode = $LASTEXITCODE

$ErrorActionPreference = $PreviousErrorActionPreference

if ($DockerExitCode -ne 0) {
  throw "Docker Desktop engine is not running. Start Docker Desktop and retry."
}

# ============================================================
# Obtain AWS account information
# ============================================================

$AccountId = aws sts get-caller-identity `
  --query Account `
  --output text

if (
  $LASTEXITCODE -ne 0 -or
  [string]::IsNullOrWhiteSpace($AccountId) -or
  $AccountId -eq "None"
) {
  throw "Unable to obtain the AWS account ID. Check your AWS CLI login."
}

$AccountId = $AccountId.Trim()
$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$API = "https://api.$Domain"

Write-Host ""
Write-Host "========================================"
Write-Host "Food Delivery image deployment"
Write-Host "========================================"
Write-Host "AWS Region:   $Region"
Write-Host "Domain:       $Domain"
Write-Host "API URL:      $API"
Write-Host "ECR Registry: $Registry"
Write-Host "========================================"
Write-Host ""

# ============================================================
# Log Docker in to Amazon ECR
# ============================================================

$PreviousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"

aws ecr get-login-password `
  --region $Region |
  docker login `
    --username AWS `
    --password-stdin $Registry

$EcrLoginExitCode = $LASTEXITCODE
$ErrorActionPreference = $PreviousErrorActionPreference

if ($EcrLoginExitCode -ne 0) {
  throw "Amazon ECR Docker login failed."
}

# ============================================================
# Build and push function
# ============================================================

function BuildPush {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [string]$Context,

    [string[]]$BuildArgs = @()
  )

  $Image = "$Registry/${Name}:latest"

  if (-not (Test-Path -Path $Context -PathType Container)) {
    throw "Docker build context does not exist: $Context"
  }

  Write-Host ""
  Write-Host "========================================"
  Write-Host "Building: $Name"
  Write-Host "Context:  $Context"
  Write-Host "Image:    $Image"
  Write-Host "========================================"

  $DockerArguments = @(
    "build",
    "--pull",
    "--progress=plain",
    "--provenance=false",
    "-t",
    $Image
  )

  foreach ($BuildArgument in $BuildArgs) {
    $DockerArguments += "--build-arg"
    $DockerArguments += $BuildArgument
  }

  $DockerArguments += $Context

  $DockerBuildExitCode = 1

  # Retry once if Docker encounters a temporary BuildKit failure.
  for ($Attempt = 1; $Attempt -le 2; $Attempt++) {
    Write-Host ""
    Write-Host "Docker build attempt $Attempt of 2: $Name"

    $PreviousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    & docker @DockerArguments
    $DockerBuildExitCode = $LASTEXITCODE

    $ErrorActionPreference = $PreviousPreference

    if ($DockerBuildExitCode -eq 0) {
      break
    }

    if ($Attempt -lt 2) {
      Write-Warning "Build attempt failed for $Name. Checking Docker engine."

      $PreviousPreference = $ErrorActionPreference
      $ErrorActionPreference = "Continue"

      docker info *> $null
      $DockerStillRunning = ($LASTEXITCODE -eq 0)

      $ErrorActionPreference = $PreviousPreference

      if (-not $DockerStillRunning) {
        throw "Docker Desktop stopped during the $Name build. Restart Docker Desktop and rerun the script."
      }

      Write-Host "Docker is still running. Retrying in 5 seconds."
      Start-Sleep -Seconds 5
    }
  }

  if ($DockerBuildExitCode -ne 0) {
    throw "Docker build failed after two attempts: $Name"
  }

  Write-Host ""
  Write-Host "Pushing: $Image"

  $PreviousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"

  docker push $Image
  $DockerPushExitCode = $LASTEXITCODE

  $ErrorActionPreference = $PreviousPreference

  if ($DockerPushExitCode -ne 0) {
    throw "Docker push failed: $Name"
  }

  Write-Host "Successfully built and pushed: $Name"
}

# ============================================================
# Backend services
# ============================================================

BuildPush `
  -Name "auth-service" `
  -Context "./services/auth-service"

BuildPush `
  -Name "order-service" `
  -Context "./services/order-service"

BuildPush `
  -Name "payment-service" `
  -Context "./services/payment-service"

BuildPush `
  -Name "tracking-service" `
  -Context "./services/tracking-service"

BuildPush `
  -Name "catalog-service" `
  -Context "./services/catalog-service"

# ============================================================
# Authentication frontend
# ============================================================

BuildPush `
  -Name "auth-app" `
  -Context "./apps/auth-app" `
  -BuildArgs @(
    "VITE_AUTH_API_URL=$API",
    "VITE_CUSTOMER_APP_URL=https://customer.$Domain",
    "VITE_RESTAURANT_APP_URL=https://restaurant.$Domain",
    "VITE_DELIVERY_APP_URL=https://delivery.$Domain",
    "VITE_ADMIN_APP_URL=https://admin.$Domain"
  )

# ============================================================
# Customer frontend
# ============================================================

BuildPush `
  -Name "customer-app" `
  -Context "./apps/customer-app" `
  -BuildArgs @(
    "VITE_AUTH_API_URL=$API",
    "VITE_ORDER_SERVICE_URL=$API",
    "VITE_PAYMENT_SERVICE_URL=$API",
    "VITE_TRACKING_SERVICE_URL=$API",
    "VITE_CATALOG_SERVICE_URL=$API",
    "VITE_AUTH_APP_URL=https://auth.$Domain",
    "VITE_RESTAURANT_ID=11111111-1111-1111-1111-111111111111",
    "VITE_GOOGLE_MAPS_API_KEY=$GoogleMapsApiKey"
  )

# ============================================================
# Restaurant frontend
# ============================================================

BuildPush `
  -Name "restaurant-app" `
  -Context "./apps/restaurant-app" `
  -BuildArgs @(
    "VITE_AUTH_API_URL=$API",
    "VITE_ORDER_SERVICE_URL=$API",
    "VITE_PAYMENT_SERVICE_URL=$API",
    "VITE_TRACKING_SERVICE_URL=$API",
    "VITE_CATALOG_SERVICE_URL=$API",
    "VITE_AUTH_APP_URL=https://auth.$Domain",
    "VITE_RESTAURANT_ID=11111111-1111-1111-1111-111111111111"
  )

# ============================================================
# Delivery frontend
# ============================================================

BuildPush `
  -Name "delivery-app" `
  -Context "./apps/delivery-app" `
  -BuildArgs @(
    "VITE_AUTH_API_URL=$API",
    "VITE_ORDER_SERVICE_URL=$API",
    "VITE_PAYMENT_SERVICE_URL=$API",
    "VITE_TRACKING_SERVICE_URL=$API",
    "VITE_AUTH_APP_URL=https://auth.$Domain"
  )

# ============================================================
# Administrator frontend
# ============================================================

BuildPush `
  -Name "admin-panel" `
  -Context "./apps/admin-panel" `
  -BuildArgs @(
    "VITE_AUTH_API_URL=$API",
    "VITE_ORDER_SERVICE_URL=$API",
    "VITE_PAYMENT_SERVICE_URL=$API",
    "VITE_TRACKING_SERVICE_URL=$API",
    "VITE_CATALOG_SERVICE_URL=$API",
    "VITE_AUTH_APP_URL=https://auth.$Domain"
  )

Write-Host ""
Write-Host "========================================"
Write-Host "All 10 images built and pushed successfully."
Write-Host "Registry: $Registry"
Write-Host "Domain:   $Domain"
Write-Host "API URL:  $API"
Write-Host "========================================"