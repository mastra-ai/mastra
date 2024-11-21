import { join } from 'path';
import postgres from 'postgres';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

// Create a postgres connection
const connection = postgres(process.env.DB_URL!);
const db = drizzle(connection);

// Run migrations
async function runMigrations() {
  const folder = join('./dist/postgres/drizzle');

  await migrate(db, { migrationsFolder: folder });
}

runMigrations()
  .then(() => {
    console.log('Migrations complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migrations failed!', err);
    process.exit(1);
  });
