# Central Authentication Workflow

This project keeps the four existing frontend applications separate. The only application workflow change is the addition of a central authentication entry point.

## Flow

1. Open **Auth App** (`http://localhost:9000`).
2. Register or login.
3. The Auth Service validates credentials and creates a JWT.
4. The user's JWT contains the role: `CUSTOMER`, `RESTAURANT`, `DELIVERY`, or `ADMIN`.
5. The Auth App redirects the user to the matching application:
   - CUSTOMER -> `http://localhost:9001`
   - RESTAURANT -> `http://localhost:9002`
   - DELIVERY -> `http://localhost:9003`
   - ADMIN -> `http://localhost:9004`
6. Each application validates the JWT role before displaying its existing UI.
7. Logout clears the local authentication data and returns to the central Auth App.

## Services that remain unchanged

- Order Service: port 4000
- Payment Service: port 4001
- Tracking Service: port 4002
- Existing application business screens and order workflow remain in place.

## Run

```bash
docker compose up --build
```

Then open:

```text
http://localhost:9000
```

## Test accounts

Use registration to create test users for each role. For production, do not allow unrestricted public registration of the `ADMIN` role; provision administrators through a controlled process.

## Important

The JWT is passed to an application once through its URL and then removed from the visible address bar by the application. This keeps the four applications independently deployable while giving them one central login/registration entry point.

## First-run / database reset

If you previously ran an older version and PostgreSQL has an existing Docker volume, reset it once so the new `users` table is initialized:

```bash
docker compose down -v
docker compose up --build
```

Do not use `down -v` if you need to preserve existing local database data.

## Local URLs

- Auth: http://localhost:9000
- Customer: http://localhost:9001
- Restaurant: http://localhost:9002
- Delivery: http://localhost:9003
- Admin: http://localhost:9004
- Auth API: http://localhost:4003
- Order API: http://localhost:4000
- Payment API: http://localhost:4001
- Tracking API: http://localhost:4002

## Important application behavior

- Customer orders use the UUID of the authenticated customer account.
- Customer and restaurant apps use the same demo restaurant UUID `11111111-1111-1111-1111-111111111111`.
- Public registration allows CUSTOMER, RESTAURANT, and DELIVERY. ADMIN accounts are intentionally not created through public registration.
- The existing order/payment/tracking business services remain otherwise unchanged.
