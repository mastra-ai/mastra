import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'stories_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

export const db = drizzle(pool, { schema });

export async function initDb() {
  try {
    await pool.query('SELECT 1');
    console.log('✓ Database connected');
  } catch (err) {
    console.error('✗ Database connection failed:', err);
    throw err;
  }
}

export async function closeDb() {
  await pool.end();
}
