# Food Delivery Platform — Corrected AWS Build

> **Start here:** `AWS-DEPLOYMENT-GUIDE.md` is the supported beginning-to-end AWS procedure. `FIX-REPORT.md` lists the production/deployment fixes applied to this package. The supported deployment uses ECS Fargate for all 5 frontend apps and all 5 backend services.

# Food Delivery Microservices Platform

## Local functional test flow

Frontend ports for local Docker testing:

- Auth: http://localhost:9000
- Customer: http://localhost:9001
- Restaurant: http://localhost:9002
- Delivery: http://localhost:9003
- Admin: http://localhost:9004

Backend ports:

- Order service: http://localhost:4000
- Payment service: http://localhost:4001
- Tracking service: http://localhost:4002
- Auth service: http://localhost:4003
- PostgreSQL: localhost:5432

The local demo restaurant uses the UUID `11111111-1111-1111-1111-111111111111`. Customer and restaurant applications use this same value so a placed order appears in the restaurant app.

#
## Safe Test Payment Mode

The local payment service is intentionally **not a real payment processor**. It behaves like a gateway for demo/testing purposes:

- `REQUIRES_CONFIRMATION` → `PROCESSING` → `SUCCEEDED` or `FAILED`
- Verifies the payment amount against the order total
- Generates a `TEST-TXN-...` transaction ID for successful tests
- Supports deterministic decline, insufficient-funds and processing-error scenarios
- Supports retry and simulated refund flows
- Stores only masked card data (`cardLast4`); never stores a full card number or CVV
- Clearly labels the customer checkout as **TEST MODE — NO REAL PAYMENT**

Test cards:

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 9987` | Processing error |

## Start locally

```bash
docker compose build
docker compose up -d
docker compose ps
```

### Functional flow

1. Open Auth at `http://localhost:9000`.
2. Register a CUSTOMER, RESTAURANT, and DELIVERY account.
3. Log in as CUSTOMER and place an order.
4. Log in as RESTAURANT and advance the order: `PLACED -> ACCEPTED -> PREPARING -> OUT_FOR_DELIVERY`.
5. Log in as DELIVERY, accept the delivery, start location sharing, and mark it delivered.
6. The customer page polls the order and receives live Socket.IO location updates.
7. Provision an ADMIN account for the local test and log in through Auth to reach `http://localhost:9004`.

### Provision a local admin

Admin registration is intentionally disabled. With the stack running, use PowerShell: 

```powershell
docker compose exec -e ADMIN_EMAIL=admin@fooddelivery.local -e ADMIN_PASSWORD='Admin123!' auth-service node src/scripts/provision-local-admin.js
```

Then open `http://localhost:9000` and log in with those credentials.

> For production, use a secret manager and a controlled admin provisioning process instead of the example local password.


A real-time food delivery platform built with a microservices backend, four
React frontends, and a full AWS DevOps deployment stack (VPC, ALB, ECS Fargate, optional EKS/Kubernetes,
Lambda, CloudWatch, CloudTrail, CloudFormation, Route 53, Jenkins, Ansible, RDS, S3, SNS, IAM).

## What's included

```
food-delivery-platform/
├── apps/                        # 4 React (Vite) frontends
│   ├── customer-app/            # browse menu, place order, pay, track delivery live
│   ├── restaurant-app/          # view incoming orders, advance status
│   ├── delivery-app/            # accept deliveries, broadcast live GPS
│   └── admin-panel/             # order overview, revenue, filters
├── services/                    # Backend microservices (Node.js/Express)
│   ├── order-service/           # orders CRUD + status, Postgres/RDS, SNS events
│   ├── payment-service/         # dummy payment gateway
│   └── tracking-service/        # WebSocket live location tracking
├── lambda/order-notifier/       # SNS-triggered Lambda for order notifications
├── infrastructure/
│   ├── cloudformation/          # VPC, ALB, RDS, S3, SNS/Lambda, ECR, ECS, CloudWatch,
│   │                             CloudTrail, Route 53 — nested stacks, root: main-stack.yaml
│   ├── k8s/                     # Optional EKS manifests
│   ├── jenkins/Jenkinsfile      # CI/CD: build → test → ECR push → ECS Fargate deploy
│   └── ansible/                 # Configures backend EC2 servers (Docker install, app deploy)
└── docker-compose.yml           # Run the whole stack locally in one command
```


## Updated application workflow

The four existing frontends remain separate applications. The only workflow change is a new central authentication entry point:

```text
LOGIN / REGISTER
       |
       v
Authentication Service (JWT + bcrypt)
       |
   Check role
   /    |     \
  v     v      v
Customer Restaurant Delivery
  |        |       |
  v        v       v
Customer  Restaurant Delivery
  App       App      App
   \        |       /
        Backend Services
             |
      Order / Payment / Tracking
             |
          Database
             ^
             |
         Admin Panel
```

Local authentication entry point:
- Auth app: http://localhost:9000
- Auth API: http://localhost:4003

After login, the central auth app redirects the user to the correct existing app:
- CUSTOMER → http://localhost:9001
- RESTAURANT → http://localhost:9002
- DELIVERY → http://localhost:9003
- ADMIN → http://localhost:9004

The existing order, payment, tracking, Lambda, infrastructure and deployment files are otherwise preserved. The new auth layer is additive; it does not replace the existing business services.

## Architecture

```
Route 53 → Application Load Balancer → Frontend (ECS Fargate: customer/restaurant/delivery/admin)
                                       → Backend microservices (EKS/Kubernetes: order, payment, tracking)
                                            → RDS (Postgres, orders)
                                            → S3 (food images)
                                       → CloudWatch + CloudTrail + Lambda (SNS-triggered notifications)
```

## Run it locally (no AWS needed)

Requires Docker + Docker Compose.

```bash
docker compose up --build
```

Then open:
- Customer app: http://localhost:9001
- Restaurant app: http://localhost:9002
- Delivery app: http://localhost:9003
- Admin panel: http://localhost:9004
- Order service API: http://localhost:4000/api/orders
- Payment service API: http://localhost:4001/api/payments
- Tracking service (WebSocket): http://localhost:4002

**Demo flow:** place an order in the customer app → it's charged automatically via the
dummy payment service → open the restaurant app to accept/advance it → once it's
"Out for delivery", open the delivery app, accept it, and click "Start sharing location"
→ back in the customer app you'll see the live coordinates update over WebSocket → open
the admin panel to see it all in the order table.

## Run services individually (dev mode)

Each service/app has its own `package.json`. Example:

```bash
cd services/order-service
cp .env.example .env      # point at a local Postgres
npm install
npm run dev
```

## Deploying to AWS

1. **Provision infrastructure** — upload the templates in `infrastructure/cloudformation/`
   to an S3 bucket, then deploy the root stack:
   ```bash
   aws cloudformation deploy \
     --template-file infrastructure/cloudformation/main-stack.yaml \
     --stack-name food-delivery \
     --capabilities CAPABILITY_NAMED_IAM \
     --parameter-overrides TemplateBucket=<your-templates-bucket> DBPassword=<secret>
   ```
   This provisions the VPC, subnets, NAT/IGW, security groups, ALB, RDS, S3, SNS + Lambda,
   ECR repos, the ECS Fargate frontend service, and CloudTrail. Deploy
   `infrastructure/cloudformation/cloudwatch-monitoring.yaml` and `route53.yaml` separately
   once you have your ALB DNS name / hosted zone ID.

2. **Create an EKS cluster** (e.g. via `eksctl`) in the VPC created above, install the
   AWS Load Balancer Controller, then apply:
   ```bash
   kubectl apply -f infrastructure/k8s/namespace.yaml
   kubectl apply -f infrastructure/k8s/order-service-secrets.example.yaml   # fill in real values first
   kubectl apply -f infrastructure/k8s/
   ```

3. **Configure Jenkins** with AWS credentials and point it at `infrastructure/jenkins/Jenkinsfile`.
   The pipeline builds every service/app, pushes images to ECR, rolls out the backend to
   EKS (`kubectl set image` + `rollout status`), force-redeploys the ECS frontend service,
   optionally triggers CodeDeploy for blue-green/canary, runs a smoke test, and automatically
   runs `kubectl rollout undo` on failure.

4. **Configure remaining backend EC2 servers** (if not fully containerized on EKS) with:
   ```bash
   cd infrastructure/ansible
   ansible-playbook -i inventory.ini site.yml --ask-vault-pass
   ```

## Notes on the "Advanced Add-ons"

- **Blue-green / canary**: the ALB template provisions a second ("green") target group,
  and the Jenkinsfile has a dedicated stage that invokes CodeDeploy when you pass
  `DEPLOY_STRATEGY=blue-green` or `canary`. You'll need to create the CodeDeploy
  application/deployment group referenced there.
- **Horizontal Pod Autoscaling**: `order-service-deployment.yaml` includes an HPA scaling
  2–10 pods on CPU.
- **EC2 Auto Scaling / ECS auto scaling**: `ecs-frontend.yaml` includes an
  `ApplicationAutoScaling::ScalableTarget` + target-tracking policy on CPU.
- **CloudWatch dashboard**: `cloudwatch-monitoring.yaml`.
- **Jenkins rollback stage**: see the `post { failure { ... } }` block in the Jenkinsfile.
- **Ansible inventory for multiple servers**: `infrastructure/ansible/inventory.ini` (static)
  and `aws_ec2.yaml` (dynamic, tag-based).
- **CloudFormation nested stacks**: `main-stack.yaml` composes all the other templates.

## Honest limitations / what you'll still need to fill in

- Payment service runs in **SAFE TEST MODE**: it simulates realistic payment intents, processing, approvals/declines, retries and refunds without contacting any real payment processor. Full card numbers and CVVs are never stored. Use only the documented test cards.
- The Lambda in `main-stack.yaml` deploys a placeholder inline stub; the real code lives in
  `lambda/order-notifier/` — package and push it via `aws lambda update-function-code`
  (the Jenkinsfile is a good place to add that step).
- No auth/JWT layer is included — every service trusts the caller-supplied IDs. Add an
  auth service or API Gateway authorizer before going to production.
- Domain names, ECR account IDs, and ARNs throughout are placeholders — replace before deploying.


## Corrected AWS architecture (default path)

The project now uses **ECS Fargate as the default runtime for all nine containers**:

- auth-app
- customer-app
- restaurant-app
- delivery-app
- admin-panel
- auth-service
- order-service
- payment-service
- tracking-service

The ALB routes `auth.*`, `customer.*`, `restaurant.*`, `delivery.*`, `admin.*`, and `api.*` traffic to the correct target groups. Backend APIs are routed by `/api/auth`, `/api/orders`, `/api/payments`, and `/api/tracking`.

The ECR stack now contains repositories for all nine images. The Jenkins pipeline builds and deploys all nine services to ECS; it no longer requires an EKS cluster for the default deployment. The Kubernetes files remain as an optional advanced deployment path.

### EC2 requirement

ECS Fargate, RDS PostgreSQL, ALB, ECR, S3, SNS, and Lambda do not require you to create application EC2 instances. For the recommended CI/CD setup, create **one EC2 instance only for Jenkins**. You can also use GitHub Actions and create **zero EC2 instances**.

### Production API configuration

The frontend Dockerfiles now accept Vite build arguments for production URLs. The application code appends its API paths, so set the base API URL to `http://api.<your-domain>` rather than including `/api/orders` or `/api/auth` in the variable value.

### Tracking note

The tracking service currently stores live locations in memory. The ECS deployment therefore starts one tracking task to avoid cross-task state divergence. For production high availability, move this state to ElastiCache Redis and then increase the service count.

## UI/CRUD upgrade (August 2026)

This version adds the requested admin, customer-profile, food-image and navigation work.

### Admin login
- URL: http://localhost:9000
- Email: `admin@fooddelivery.local`
- Password: `Admin@12345`
- The auth service provisions this local admin automatically from `docker-compose.yml`.

### Admin panel
Open http://localhost:9004 after logging in as ADMIN.
- Restaurants: add, edit, delete, upload restaurant image, open/close restaurant.
- Food CRUD: add, edit, delete, change price, enable/disable, upload food image.
- Orders: platform-wide order view with ordered-food images.

### Customer app
Open http://localhost:9001 after logging in as CUSTOMER.
- Restaurant listing and restaurant details.
- Food cards with images, price and availability.
- Cart and test checkout.
- Profile Management: name, email, mobile, profile photo, multiple addresses.
- Change password.
- Order history with food images.
- BrowserRouter navigation for Home / Restaurant / Checkout / Orders / Profile, so browser Back and Forward work normally.

### Restaurant app
Open http://localhost:9002 after logging in as RESTAURANT.
- Dashboard, menu and incoming orders.
- Ordered food images are shown in every order.
- Order status progression remains available.
- Browser Back/Forward works through real application routes.

### New service
`catalog-service` runs on port `4004` and stores restaurants, menu items and uploaded restaurant/food images. Uploaded images are persisted in the Docker `catalog_uploads` volume.

`auth-service` now stores mobile, profile photo and saved addresses and exposes profile/password/photo APIs. Profile photos are persisted in the Docker `auth_uploads` volume.

### First clean run
Because the PostgreSQL database uses a named volume, if an older copy of this project is already running, use:

```bash
docker compose down -v
docker compose up --build
```

Use `down -v` only when you are okay with deleting the local demo PostgreSQL data. For an existing environment where data must be preserved, run the services normally; both auth and catalog services also perform their own startup migrations.

### URLs
- Auth: http://localhost:9000
- Customer: http://localhost:9001
- Restaurant: http://localhost:9002
- Delivery: http://localhost:9003
- Admin: http://localhost:9004
- Auth API: http://localhost:4003
- Order API: http://localhost:4000
- Payment API: http://localhost:4001
- Tracking API: http://localhost:4002
- Catalog API: http://localhost:4004

## Fixed AWS deployment

For the corrected beginner-friendly AWS deployment, start with:

**`AWS-DEPLOYMENT-GUIDE-FIXED.md`**

The guide matches the current infrastructure files and deploys all 10 application containers through ECS Fargate behind an HTTPS ALB, with RDS PostgreSQL, S3, Secrets Manager, SNS/Lambda, CloudWatch, CloudTrail and Route 53.
