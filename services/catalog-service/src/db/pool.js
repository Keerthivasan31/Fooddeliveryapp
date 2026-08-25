const { Pool } = require('pg');
module.exports = new Pool({host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||5432),user:process.env.DB_USER||'orders_user',password:process.env.DB_PASSWORD||'orders_pass',database:process.env.DB_NAME||'orders_db',ssl:process.env.DB_SSL==='true'?{rejectUnauthorized:false}:false});
