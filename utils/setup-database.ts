import { config } from 'dotenv';

import { runMigrations } from '../packages/engine/dist/postgres/migrate';

config();

async function setupDatabase() {
  try {
    const dbUrl = process.env.DB_URL!;
    console.log('dbUrl', dbUrl);

    console.log('Running migrations...');
    await runMigrations(dbUrl);
    console.log('Migrations completed successfully');

    console.log('Database setup completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();
