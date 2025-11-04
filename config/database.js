const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  // Additional connection options
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 20, // maximum number of clients in the pool
});

// Better connection test with error handling
pool.on('connect', () => {
  console.log('✅ Database connection established');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

// Test connection function
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL');
    const result = await client.query('SELECT NOW()');
    console.log('⏰ Database time:', result.rows[0].now);
    client.release();
  } catch (err) {
    console.error('❌ Connection test failed:', err.message);
  }
}

testConnection();

module.exports = pool;