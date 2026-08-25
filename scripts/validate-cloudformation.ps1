param([string]$Region="ap-south-1",[string]$TemplateBucket=$env:TEMPLATE_BUCKET)
$ErrorActionPreference="Stop"
if(-not $TemplateBucket){ throw "Set TEMPLATE_BUCKET first." }
aws s3 sync infrastructure/cloudformation "s3://$TemplateBucket" --region $Region
$files = @('main-stack.yaml','vpc.yaml','alb.yaml','rds.yaml','s3-storage.yaml','sns-order-alerts.yaml','ecr.yaml','ecs-frontend.yaml','cloudwatch-monitoring.yaml','cloudtrail.yaml','route53.yaml')
foreach($f in $files){
  Write-Host "Validating $f"
  aws cloudformation validate-template --template-url "https://$TemplateBucket.s3.$Region.amazonaws.com/$f" --region $Region | Out-Null
  if($LASTEXITCODE -ne 0){ throw "Validation failed: $f" }
}
Write-Host "All CloudFormation templates passed AWS validation."
