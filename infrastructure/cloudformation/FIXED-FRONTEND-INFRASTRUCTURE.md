# Fixed AWS Frontend Infrastructure

This folder fixes the previous issue where `ecs-frontend.yaml` deployed only
`customer-app` even though ECR and Jenkins expect four frontend applications.

The corrected files are:

- `alb.yaml` - four target groups and host-based routing
- `ecs-frontend.yaml` - four ECS Fargate services
- `main-stack.yaml` - passes all four image URIs and target groups

Frontend hostnames expected by the ALB rules:

- customer: default ALB hostname
- restaurant: `restaurant.<your-domain>`
- delivery: `delivery.<your-domain>`
- admin: `admin.<your-domain>`

For a real domain, configure Route 53 records for the ALB and use HTTPS/ACM
before production use.

IMPORTANT:
1. Push all four frontend images to ECR before creating the ECS stack.
2. Upload these corrected YAML files to the CloudFormation template S3 bucket.
3. If an old `food-delivery` CloudFormation stack already exists, update it
   rather than creating a duplicate stack.
4. Do not delete an existing production RDS database just to apply this fix.
