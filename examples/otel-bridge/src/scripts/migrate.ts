import { sql } from 'drizzle-orm';
import { db } from '../db.js';

async function migrate() {
  try {
    console.log('Creating tables...');

    // Create stories table
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS stories (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        content TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `));

    // Create characters table
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS characters (
        id SERIAL PRIMARY KEY,
        story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `));

    // Create story_outlines table
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS story_outlines (
        id SERIAL PRIMARY KEY,
        story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE,
        sections JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `));

    console.log('✓ Migration completed');
    process.exit(0);
  } catch (err) {
    console.error('✗ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
