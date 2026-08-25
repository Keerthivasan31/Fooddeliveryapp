const { Pool } = require('pg');

// RDS connection pool. Credentials come from environment variables,
// which in production are injected via ECS task definition / K8s secrets
// (sourced from AWS Secrets Manager or SSM Parameter Store).
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'orders_user',
  password: process.env.DB_PASSWORD || 'orders_pass',
  database: process.env.DB_NAME || 'orders_db',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle DB client', err);
});

module.exports = pool;
