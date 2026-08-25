# Safe Test Payment Service

This service is a **simulated payment gateway** for local/demo use. It never contacts a real payment processor and never stores a full card number or CVV.

## Test cards

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | SUCCESS |
| `4000 0000 0000 0002` | CARD_DECLINED |
| `4000 0000 0000 9995` | INSUFFICIENT_FUNDS |
| `4000 0000 0000 9987` | PROCESSING_ERROR |

Use any future `MM/YY` expiry and `123` as the CVV.

## Flow

1. Customer app creates an order.
2. Customer app creates a payment intent.
3. Payment service verifies the amount against the order service.
4. Payment enters `PROCESSING` for about 1.2 seconds.
5. The deterministic test card decides the simulated outcome.
6. The order service is notified with `SUCCESS` or `FAILED`.
7. Successful payments receive a `TEST-TXN-...` transaction ID.
8. Refunds can be simulated for successful payments.

Only masked card data (`cardLast4`) is returned/stored by this service.

## API

- `GET /health`
- `GET /api/payments/test-cards`
- `POST /api/payments/intents`
- `POST /api/payments/:id/confirm`
- `GET /api/payments/:id`
- `GET /api/payments/order/:orderId`
- `POST /api/payments/:id/refund`
- `POST /api/payments/charge` (backwards-compatible one-call endpoint)
