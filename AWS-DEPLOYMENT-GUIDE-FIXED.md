# Food Delivery Platform — Correct AWS Deployment Guide

This is the supported deployment guide for the corrected project.

## 1. Final architecture

- Route 53: `fooddeliveryapp.com`
- ACM: root + wildcard HTTPS certificate
- ALB: host-based frontend routing + path-based API routing
- ECS Fargate: all 5 frontend apps and all 5 backend services
- RDS PostgreSQL: private database
- S3: private food/profile image storage
- SNS -> Lambda: order notifications (dry-run by default unless SES is configured)
- CloudWatch: ECS logs, dashboard, ALB alarms
- CloudTrail: auditing
- ECR: 10 repositories
- Private ECS subnets with NAT gateway

The Kubernetes manifests under `infrastructure/k8s/` are optional learning material and are **not** part of this deployment.

## 2. URLs

| Component | Production URL |
|---|---|
| Root/customer | `https://fooddeliveryapp.com` |
| Auth portal | `https://auth.fooddeliveryapp.com` |
| Customer | `https://customer.fooddeliveryapp.com` |
| Restaurant | `https://restaurant.fooddeliveryapp.com` |
| Delivery | `https://delivery.fooddeliveryapp.com` |
| Admin | `https://admin.fooddeliveryapp.com` |
| API | `https://api.fooddeliveryapp.com` |

Browser code must call the API hostname. It must never call ECS service names or `localhost` in production.

## 3. Ports

- order-service: 4000
- payment-service: 4001
- tracking-service: 4002
- auth-service: 4003
- catalog-service: 4004
- all frontend nginx containers: 80
- local frontend host ports: 9000-9004

## 4. Prerequisites

Install and start:

1. AWS CLI v2
2. Docker Desktop
3. PowerShell 7/Windows PowerShell
4. A Route 53 public hosted zone for `fooddeliveryapp.com`

Check:

```powershell
aws sts get-caller-identity
docker version
```

Do not paste AWS secret access keys, database passwords, JWT secrets, admin passwords, or Google Maps keys into chat/Git.

## 5. Set PowerShell variables

```powershell
$env:AWS_REGION = "ap-south-1"
$env:PROJECT = "food-delivery"
$env:ENVIRONMENT = "food-delivery-prod"
$env:DOMAIN = "fooddeliveryapp.com"
$env:HOSTED_ZONE_ID = "Z0704598LRYVDLNKHE16"
$env:AWS_ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
$env:TEMPLATE_BUCKET = "food-delivery-cfn-$env:AWS_ACCOUNT_ID"
```

Check:

```powershell
$env:AWS_REGION
$env:DOMAIN
$env:HOSTED_ZONE_ID
$env:TEMPLATE_BUCKET
```

## 6. Route 53 prerequisite

The hosted zone must contain its NS and SOA records. Do not delete them. If the domain was purchased outside Route 53, the registrar must use the four nameservers shown in the hosted zone. ACM DNS validation cannot complete until delegation is correct.

## 7. Local test before AWS

Create a local `.env` only if you want Google Maps locally:

```text
GOOGLE_MAPS_API_KEY=YOUR_BROWSER_KEY
```

Then:

```powershell
docker compose down -v
docker compose build --no-cache
docker compose up -d
docker compose ps
```

Open:

- Auth portal: `http://localhost:9000`
- Customer: `http://localhost:9001`
- Restaurant: `http://localhost:9002`
- Delivery: `http://localhost:9003`
- Admin: `http://localhost:9004`

Backend health checks:

```powershell
curl.exe http://localhost:4000/health
curl.exe http://localhost:4001/health
curl.exe http://localhost:4002/health
curl.exe http://localhost:4003/health
curl.exe http://localhost:4004/health
```

Local default admin is only for local Docker testing: `admin@fooddelivery.local` / `Admin@12345`. Do not reuse this password in AWS.

## 8. Upload and validate CloudFormation

If the bucket has already been created, sync is enough:

```powershell
aws s3 sync infrastructure/cloudformation "s3://$env:TEMPLATE_BUCKET" --region $env:AWS_REGION
.\scripts\validate-cloudformation.ps1 -Region $env:AWS_REGION -TemplateBucket $env:TEMPLATE_BUCKET
```

If your bucket does not exist:

```powershell
aws s3 mb "s3://$env:TEMPLATE_BUCKET" --region $env:AWS_REGION
```

## 9. Generate deployment secrets locally

Use strong values. The examples below keep the values in this PowerShell session.

```powershell
$env:DB_PASSWORD = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 24 | ForEach-Object {[char]$_})
$env:JWT_SECRET = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
$env:ADMIN_PASSWORD = "ChangeThis-Admin-Password-2026!"
```

Replace the example admin password with your own strong password and save it in a password manager. The production admin email is `admin@fooddeliveryapp.com`.

## 10. Phase 1 — deploy infrastructure and ECR, but not ECS apps

This two-phase process fixes the old bootstrap problem where ECS tried to start before images existed.

```powershell
aws cloudformation deploy `
  --stack-name $env:ENVIRONMENT `
  --template-file infrastructure/cloudformation/main-stack.yaml `
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND `
  --region $env:AWS_REGION `
  --parameter-overrides `
    EnvironmentName=$env:ENVIRONMENT `
    TemplateBucket=$env:TEMPLATE_BUCKET `
    DBPassword=$env:DB_PASSWORD `
    JwtSecret=$env:JWT_SECRET `
    AdminPassword=$env:ADMIN_PASSWORD `
    FrontendBaseDomain=$env:DOMAIN `
    HostedZoneId=$env:HOSTED_ZONE_ID `
    DeployApplication=false `
    DesiredCount=1
```

Watch:

```powershell
aws cloudformation describe-stacks --stack-name $env:ENVIRONMENT --region $env:AWS_REGION --query "Stacks[0].StackStatus" --output text
```

Do not continue if the stack ends in `ROLLBACK_*` or `*_FAILED`. Inspect events:

```powershell
aws cloudformation describe-stack-events --stack-name $env:ENVIRONMENT --region $env:AWS_REGION --max-items 30
```

Phase 1 creates VPC, NAT, ALB, ACM certificate, Route 53 aliases, RDS, S3, SNS/Lambda, ECR, CloudWatch, CloudTrail and Secrets Manager. The ALB can temporarily return 503 because ECS targets are intentionally not deployed yet.

## 11. Verify ECR repositories

```powershell
aws ecr describe-repositories --region $env:AWS_REGION --query "repositories[].repositoryName" --output table
```

Expected repositories:

`auth-service`, `order-service`, `payment-service`, `tracking-service`, `catalog-service`, `auth-app`, `customer-app`, `restaurant-app`, `delivery-app`, `admin-panel`.

## 12. Google Maps production key

For the browser key, enable Maps JavaScript API and restrict website referrers to at least:

```text
https://customer.fooddeliveryapp.com/*
https://fooddeliveryapp.com/*
```

Set it only in your PowerShell session:

```powershell
$env:GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_BROWSER_KEY"
```

The key is a Vite build-time value, so changing an ECS environment variable later will not update a previously built frontend image. Rebuild `customer-app` after changing the key.

## 13. Build and push all 10 images

From the project root:

```powershell
.\scripts\build-and-push-images.ps1 `
  -Region $env:AWS_REGION `
  -Domain $env:DOMAIN `
  -GoogleMapsApiKey $env:GOOGLE_MAPS_API_KEY
```

The script logs Docker into ECR, builds every backend and frontend image, injects the production URLs at Vite build time, and pushes `:latest` to the matching ECR repositories.

Verify:

```powershell
aws ecr describe-images --repository-name customer-app --region $env:AWS_REGION --query "imageDetails[].imageTags"
```

## 14. Phase 2 — enable ECS applications

Run the same stack as an update, changing only `DeployApplication=true`:

```powershell
aws cloudformation deploy `
  --stack-name $env:ENVIRONMENT `
  --template-file infrastructure/cloudformation/main-stack.yaml `
  --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND `
  --region $env:AWS_REGION `
  --parameter-overrides `
    EnvironmentName=$env:ENVIRONMENT `
    TemplateBucket=$env:TEMPLATE_BUCKET `
    DBPassword=$env:DB_PASSWORD `
    JwtSecret=$env:JWT_SECRET `
    AdminPassword=$env:ADMIN_PASSWORD `
    FrontendBaseDomain=$env:DOMAIN `
    HostedZoneId=$env:HOSTED_ZONE_ID `
    DeployApplication=true `
    DesiredCount=1
```

The ECS deployment circuit breaker is enabled; failed services should fail/roll back instead of hanging indefinitely.

## 15. Check ECS

```powershell
aws ecs list-clusters --region $env:AWS_REGION
aws ecs list-services --cluster "$env:ENVIRONMENT-cluster" --region $env:AWS_REGION
aws ecs describe-services --cluster "$env:ENVIRONMENT-cluster" --services auth-service order-service payment-service tracking-service catalog-service auth-app customer-app restaurant-app delivery-app admin-panel --region $env:AWS_REGION --query "services[].{name:serviceName,running:runningCount,desired:desiredCount,status:status}" --output table
```

Every service should eventually show `running=1` and `desired=1`.

## 16. Check target groups and HTTPS

Open EC2 -> Target Groups. All frontend and backend targets should become healthy.

Test:

```powershell
curl.exe https://api.fooddeliveryapp.com/health
curl.exe https://api.fooddeliveryapp.com/api/restaurants
curl.exe https://fooddeliveryapp.com
```

Then open all six frontend/root URLs listed in section 2.

## 17. Production admin login

Production admin email:

```text
admin@fooddeliveryapp.com
```

Password: the value you set in `$env:ADMIN_PASSWORD` during deployment. The auth service provisions/updates this admin account during startup.

## 18. Payment service

Payment remains intentionally TEST-only. It accepts only the documented test card numbers and never contacts a bank or real payment gateway. This is intentional.

## 19. Live tracking

The tracking service uses Socket.IO and ALB routes both `/api/tracking*` and `/socket.io*` to port 4002. It currently stores location state in memory, so this project intentionally runs the tracking service with one task by default. For horizontal production scaling, replace the in-memory map with Redis/ElastiCache and a Socket.IO Redis adapter.

## 20. Image uploads

Catalog uploads use:

```text
https://api.fooddeliveryapp.com/api/uploads/...
```

Profile images use:

```text
https://api.fooddeliveryapp.com/api/auth/uploads/...
```

S3 remains private; the backend reads objects using the ECS task role. This avoids exposing the S3 bucket publicly.

## 21. Logs

```powershell
aws logs tail "/ecs/$env:ENVIRONMENT/auth-service" --since 30m --region $env:AWS_REGION
aws logs tail "/ecs/$env:ENVIRONMENT/order-service" --since 30m --region $env:AWS_REGION
aws logs tail "/ecs/$env:ENVIRONMENT/catalog-service" --since 30m --region $env:AWS_REGION
aws logs tail "/ecs/$env:ENVIRONMENT/customer-app" --since 30m --region $env:AWS_REGION
```

Log groups are explicitly created by CloudFormation with 14-day retention.

## 22. Common failures

### ACM certificate remains pending

Confirm the registrar delegates `fooddeliveryapp.com` to the Route 53 NS records. Do not manually delete the ACM validation records.

### Frontend targets unhealthy

The corrected VPC security group permits ALB -> ECS on port 80. Check ECS task logs and target health reason.

### Backend targets unhealthy

The corrected security group permits ALB -> ECS ports 4000-4004. Check `/health` inside logs/task events.

### `CannotPullContainerError`

Confirm phase 1 completed, the ECR repository contains `latest`, and private subnets have the NAT route.

### Browser calls localhost

You built a frontend without production build arguments. Re-run `scripts/build-and-push-images.ps1`, then force a new ECS deployment or update the stack.

### Profile API gives frontend HTML

The corrected ALB routes `/api/users*` to auth-service. Re-upload the corrected `alb.yaml` and update the stack.

### Uploaded image returns frontend HTML/404

The corrected services use `/api/uploads/object/...` for catalog files and `/api/auth/uploads/...` for profile files, both covered by ALB API rules.

## 23. Cost warning

This design creates billable resources including a NAT Gateway, ALB, RDS, Fargate tasks, Route 53, CloudWatch and data transfer. `DesiredCount=1` is intentionally the default for a learning/demo environment. For higher availability later, raise desired counts and consider two NAT gateways, Multi-AZ RDS, Redis for tracking, autoscaling, WAF and stricter service-to-service authentication.

## 24. Cleanup

To remove the deployed stack:

```powershell
aws cloudformation delete-stack --stack-name $env:ENVIRONMENT --region $env:AWS_REGION
aws cloudformation wait stack-delete-complete --stack-name $env:ENVIRONMENT --region $env:AWS_REGION
```

RDS uses `DeletionPolicy: Snapshot`, so a final snapshot can remain and may incur storage cost. ECR repositories with images can also block deletion unless emptied; remove images first if CloudFormation reports ECR repository-not-empty errors.

## 25. Important fixes made in this corrected project

- Real production domain set to `fooddeliveryapp.com` in production examples and CloudFormation defaults.
- Browser production URLs point to `https://api.fooddeliveryapp.com`, never internal ECS names or localhost.
- Two-phase CloudFormation deployment prevents ECS from starting before ECR images exist.
- RDS now receives the required DB password from the root stack.
- Frontend port 80 is allowed from ALB to ECS.
- Backend ports 4000-4004 are explicitly allowed from ALB.
- Target group custom names removed to avoid AWS 32-character target-group-name failures.
- CloudWatch p95 alarm corrected to use `ExtendedStatistic`.
- CloudWatch nested stack is now actually included in the root stack.
- Explicit ECS log groups with retention replace fragile automatic log-group creation.
- ECS deployment circuit breaker/rollback enabled.
- Desired count defaults to 1 to reduce beginner/demo cost.
- `/api/users*` correctly routes to auth-service.
- Profile and catalog S3 image retrieval paths now route to the correct APIs.
- Production CORS origins are restricted to platform domains.
- Auth portal no longer passes JWTs in URL query strings; each role app has its own login/register flow.
- Root `.env` is excluded from the final package; only examples are distributed.
- Local frontend ports standardized to 9000-9004.
