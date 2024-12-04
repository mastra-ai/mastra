import { dirname, join } from 'path';
import postgres from 'postgres';
import { fileURLToPath, pathToFileURL } from 'url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Run migrations
export async function runMigrations(dburl: string) {
  // Create a postgres connection
  const connection = postgres(dburl);
  const db = drizzle(connection);

  const folder = join(__dirname, 'drizzle');
  console.log('Running migrations from', folder);

  await migrate(db, { migrationsFolder: folder });
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  runMigrations(process.env.DB_URL!)
    .then(() => {
      console.log('Migrations complete!');
      process.exit(0);
    })
    .catch(err => {
      console.error('Migrations failed!', err);
      process.exit(1);
    });
}
