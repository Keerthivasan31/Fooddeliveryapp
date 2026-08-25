require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 4002;

const allowedOrigins = String(process.env.CORS_ORIGINS || '*').split(',').map(v => v.trim()).filter(Boolean);
const corsOptions = { origin(origin, cb) { if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true); return cb(new Error('Origin not allowed by CORS')); } };

app.use(cors(corsOptions));
app.use(express.json());

// In-memory live location cache. For production/multi-instance deployments,
// replace this with Redis/ElastiCache + a durable delivery-tracking store.
const liveLocations = new Map();
const locationHistory = new Map();

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'tracking-service',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/tracking/:orderId', (req, res) => {
  const location = liveLocations.get(req.params.orderId);
  if (!location) return res.status(404).json({ error: 'No location data for this order yet' });
  res.json({
    ...location,
    history: locationHistory.get(req.params.orderId) || []
  });
});

app.get('/api/tracking/:orderId/history', (req, res) => {
  res.json(locationHistory.get(req.params.orderId) || []);
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: (origin, cb) => corsOptions.origin(origin, cb), methods: ['GET', 'POST'] }
});

function validCoordinate(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max;
}

io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id });

  socket.on('location:start', ({ orderId }) => {
    if (!orderId) return;
    socket.join(`delivery:${orderId}`);
    io.to(`order:${orderId}`).emit('tracking:started', {
      orderId,
      startedAt: new Date().toISOString()
    });
  });

  socket.on('location:update', ({ orderId, lat, lng, accuracy }) => {
    if (!orderId || !validCoordinate(lat, -90, 90) || !validCoordinate(lng, -180, 180)) return;

    const location = {
      orderId,
      lat: Number(lat),
      lng: Number(lng),
      accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
      updatedAt: new Date().toISOString()
    };

    liveLocations.set(orderId, location);

    const history = locationHistory.get(orderId) || [];
    history.push(location);
    // Keep a reasonable in-memory trail for local development.
    locationHistory.set(orderId, history.slice(-200));

    io.to(`order:${orderId}`).emit('location:changed', location);
  });

  socket.on('location:stop', ({ orderId }) => {
    if (!orderId) return;
    socket.leave(`delivery:${orderId}`);
    io.to(`order:${orderId}`).emit('tracking:stopped', {
      orderId,
      stoppedAt: new Date().toISOString()
    });
  });

  socket.on('order:subscribe', (orderId) => {
    if (!orderId) return;
    socket.join(`order:${orderId}`);
    const last = liveLocations.get(orderId);
    if (last) socket.emit('location:changed', last);
    socket.emit('tracking:history', locationHistory.get(orderId) || []);
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id });
  });
});

server.listen(PORT, () => logger.info(`Tracking service listening on port ${PORT}`));

module.exports = { app, server };
