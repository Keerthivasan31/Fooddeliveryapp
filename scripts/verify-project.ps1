$ErrorActionPreference = "Stop"
Write-Host "Checking required project files..."
$required = @(
  "infrastructure/cloudformation/main-stack.yaml","infrastructure/cloudformation/vpc.yaml","infrastructure/cloudformation/alb.yaml",
  "infrastructure/cloudformation/rds.yaml","infrastructure/cloudformation/ecr.yaml","infrastructure/cloudformation/ecs-frontend.yaml",
  "apps/auth-app/Dockerfile","apps/customer-app/Dockerfile","apps/restaurant-app/Dockerfile","apps/delivery-app/Dockerfile","apps/admin-panel/Dockerfile",
  "services/auth-service/Dockerfile","services/order-service/Dockerfile","services/payment-service/Dockerfile","services/tracking-service/Dockerfile","services/catalog-service/Dockerfile"
)
foreach ($f in $required) { if (-not (Test-Path $f)) { throw "Missing: $f" } }
Write-Host "Checking production examples do not contain example.com or localhost..."
$bad = Get-ChildItem apps -Recurse -Filter .env.production.example | Select-String -Pattern 'fooddelivery\.example\.com|localhost'
if ($bad) { $bad | Out-Host; throw "Production env examples still contain invalid hosts." }
Write-Host "Checking CloudFormation localhost/example domain references..."
$badCfn = Get-ChildItem infrastructure\cloudformation -Filter *.yaml | Select-String -Pattern 'fooddelivery\.example\.com|http://localhost'
if ($badCfn) { $badCfn | Out-Host; throw "CloudFormation still contains example/localhost production references." }
Write-Host "Static project checks passed."
