import { config } from 'dotenv';

import { generate } from '../packages/cli/src/commands/generate';
import { migrate } from '../packages/cli/src/commands/migrate';

config();

async function setupDatabase() {
  try {
    const dbUrl = process.env.DB_URL!;
    console.log('dbUrl', dbUrl);

    console.log('Generating types...');
    // await generate(dbUrl);

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
