# Corrected Project — Fix Report

## Supported deployment

The supported AWS deployment is one coherent ECS Fargate architecture for all 10 containers. The old Kubernetes files remain only as optional learning/reference files and are not used by the CloudFormation guide.

## Deployment-blocking fixes

1. Fixed root CloudFormation -> RDS password parameter propagation.
2. Added two-phase deployment (`DeployApplication=false` then `true`) so ECR repositories exist and images are pushed before ECS services are created.
3. Fixed ECS security-group ingress for frontend port 80 and API ports 4000-4004.
4. Removed explicit ALB target-group names that could exceed AWS's 32-character name limit with `food-delivery-prod`.
5. Added ALB full-name output and actually connected the CloudWatch monitoring nested stack.
6. Fixed CloudWatch p95 alarm to use `ExtendedStatistic`.
7. Added explicit CloudWatch log groups and 14-day retention.
8. Added ECS deployment circuit breaker/rollback and health-check grace periods.
9. Reduced default ECS desired count to 1 for the learning/demo deployment.
10. Corrected production domain defaults to `fooddeliveryapp.com`.
11. Removed a pinned PostgreSQL minor engine version to avoid regional minor-version availability failures.

## Routing/application fixes

1. All production Vite variables use `https://api.fooddeliveryapp.com` for APIs.
2. Added `/api/users*` -> auth-service ALB routing.
3. Profile image URLs now use `/api/auth/uploads/...`, which correctly routes to auth-service.
4. Catalog image URLs now use `/api/uploads/object/...`, which correctly routes to catalog-service.
5. Payment service's production order-service URL is the API hostname rather than the ALB DNS name/default frontend route.
6. Socket.IO remains routed through `/socket.io*` to tracking-service.
7. Production CORS is restricted to platform domains through ECS `CORS_ORIGINS`.

## Authentication fixes

1. Customer, Restaurant, Delivery and Admin retain separate role-specific login pages.
2. Auth portal is now a portal selector; it no longer transfers JWTs in URL query strings between subdomains.
3. Production admin is provisioned as `admin@fooddeliveryapp.com` using the CloudFormation `AdminPassword` secret.

## Local/developer fixes

1. Local frontend dev ports are standardized to 9000-9004.
2. `.dockerignore` added to every app/service.
3. Root `.env` removed from the distributable ZIP; only examples remain.
4. Production env example files cleaned and made consistent.
5. Jenkins pipeline corrected for 10 images, `ap-south-1`, production URLs and syntactic errors.
6. PowerShell build/push and CloudFormation validation scripts added.

## Verification performed in the packaging environment

- Parsed all 11 CloudFormation YAML templates successfully with CloudFormation intrinsic tags tolerated.
- Parsed all 41 JavaScript/JSX files with the TypeScript parser: 0 syntax failures.
- Ran `node --check` across backend JavaScript files: no syntax failures.
- Verified no distributable `.env`, PEM, or P12 secret files are present.
- Verified no non-document production configuration still references `fooddelivery.example.com`.

## Verification you must run in your AWS account

Run:

```powershell
.\scripts\validate-cloudformation.ps1 -Region $env:AWS_REGION -TemplateBucket $env:TEMPLATE_BUCKET
```

AWS account-side validation is required because it checks the templates with the real CloudFormation service and your current AWS account/region.
