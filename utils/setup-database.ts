import { config } from 'dotenv';

import { generate } from '../packages/cli/src/commands/generate';
import { migrate } from '../packages/cli/src/commands/migrate';

config();

async function setupDatabase() {
  try {
    const dbUrl = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5432/mastra';

    console.log('Generating types...');
    await generate(dbUrl);

    console.log('Running migrations...');
    await migrate(false, dbUrl);

    console.log('Database setup completed successfully');
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();
