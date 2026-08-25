# Separate Login & Registration

Each application now has its own authentication page and role guard.

| Application | Main URL | Login | Registration |
|---|---|---|---|
| Auth Hub | http://localhost:9000 | `/` | `/` |
| Customer | http://localhost:9001 | `/login` | `/register` |
| Restaurant | http://localhost:9002 | `/login` | `/register` |
| Delivery | http://localhost:9003 | `/login` | `/register` |
| Admin | http://localhost:9004 | `/login` | Disabled |

## Authentication flow

1. Open an application directly.
2. If no valid token exists, the app sends the user to its own `/login` page.
3. Login is sent to `auth-service` on port 4003.
4. The returned JWT is stored in that application's browser origin.
5. The role in the JWT must match the application.
6. Logout clears the local token and returns to that application's login page.
7. Protected pages preserve the requested path with `returnTo`.

## Registration

Customer, Restaurant and Delivery users can self-register.

Admin self-registration is intentionally disabled. The default development admin is:

- Email: `admin@fooddelivery.local`
- Password: `Admin@12345`

## Start

```bash
docker compose down -v
docker compose up --build
```

Then open one of the application URLs above.

The `auth-app` at port 9000 is retained as a central authentication hub for compatibility. The four operational applications no longer depend on port 9000 for their normal login/logout flow.
