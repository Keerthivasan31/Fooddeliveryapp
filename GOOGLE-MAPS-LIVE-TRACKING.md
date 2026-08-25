# Google Maps live delivery tracking

## 1. Create/configure the Google Maps key

Create a Google Maps API key in Google Cloud and enable **Maps JavaScript API**.
For local development, restrict the key to:

- `http://localhost:9001/*`

Do not commit a real key to Git. The root `.env` file is ignored by `.gitignore`.

## 2. Add your key once

The Customer App is the app that loads Google Maps, so its browser origin must be allowed by the key. The Delivery App only sends GPS coordinates; it does not need the Maps JavaScript API.

Create a file named `.env` beside `docker-compose.yml`:

```env
GOOGLE_MAPS_API_KEY=YOUR_REAL_GOOGLE_MAPS_KEY
```

The customer Docker build receives this as `VITE_GOOGLE_MAPS_API_KEY`.

## 3. Start the platform

```bash
docker compose down -v
docker compose up --build
```

## 4. Test the live tracking flow

1. Login to the customer app at `http://localhost:9001`.
2. Place a test order and complete the test payment.
3. Move the order through the restaurant app until the status is `OUT_FOR_DELIVERY`.
4. Login to the delivery app at `http://localhost:9003`.
5. Accept the delivery.
6. Click **Start sharing location**.
7. Allow browser location permission.
8. Return to the customer app -> **Orders**.
9. The order automatically displays **Live Delivery Tracking** and the Google Map updates whenever GPS coordinates arrive.

The delivery app uses the browser's real `navigator.geolocation.watchPosition()` instead of simulated/random coordinates.

### Important

- Browser GPS permission is required.
- `localhost` is treated as a secure context by modern browsers for geolocation.
- A Google Maps key is client-side by design. Use API restrictions and billing controls in Google Cloud.
- For production, move the tracking cache from process memory to Redis/ElastiCache so multiple delivery-service instances share location state.
