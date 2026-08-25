require('dotenv').config();
const express = require('express');
const cors = require('cors');
const paymentsRouter = require('./routes/payments');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 4001;

const allowedOrigins = String(process.env.CORS_ORIGINS || '*').split(',').map(v => v.trim()).filter(Boolean);
const corsOptions = { origin(origin, cb) { if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true); return cb(new Error('Origin not allowed by CORS')); } };

app.use(cors(corsOptions));
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'payment-dummy-service', timestamp: new Date().toISOString() });
});

app.use('/api/payments', paymentsRouter);

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Something went wrong' });
});

app.listen(PORT, () => logger.info(`Payment service listening on port ${PORT}`));

module.exports = app;
