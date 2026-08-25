require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db/pool');

async function main() {
  const email = String(process.env.ADMIN_EMAIL || 'admin@fooddelivery.local').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  const name = String(process.env.ADMIN_NAME || 'Local Admin').trim();

  if (!password || password.length < 8) {
    throw new Error('Set ADMIN_PASSWORD to a value with at least 8 characters.');
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  const passwordHash = await bcrypt.hash(password, 12);

  if (existing.rowCount) {
    await pool.query(
      'UPDATE users SET name = $1, password_hash = $2, role = $3 WHERE email = $4',
      [name, passwordHash, 'ADMIN', email]
    );
    console.log(`Updated local admin account: ${email}`);
  } else {
    await pool.query(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
      [crypto.randomUUID(), name, email, passwordHash, 'ADMIN']
    );
    console.log(`Created local admin account: ${email}`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error(err.message);
  try { await pool.end(); } catch {}
  process.exit(1);
});
