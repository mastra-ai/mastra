import { PostgresStore } from '@mastra/pg';

export const storage = new PostgresStore({
  // connectionString: process.env.POSTGRES_URL!,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5435,
});
