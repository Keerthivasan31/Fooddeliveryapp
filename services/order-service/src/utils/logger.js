const winston = require('winston');

// Structured JSON logging -> picked up by CloudWatch Logs agent / awslogs driver
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'order-service' },
  transports: [new winston.transports.Console()]
});

module.exports = logger;
