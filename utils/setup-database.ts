import { config } from 'dotenv';

import { migrate } from '../packages/cli/src/commands/engine/migrate';

config();

async function setupDatabase() {
  try {
    const dbUrl = process.env.DB_URL!;
    console.log('dbUrl', dbUrl);

    console.log('Running migrations...');
    await migrate(dbUrl);
    console.log('Migrations completed successfully');

    console.log('Database setup completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();
