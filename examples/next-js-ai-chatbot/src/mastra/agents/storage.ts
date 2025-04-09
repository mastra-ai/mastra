import { PostgresStore } from '@mastra/pg';

export const storage = new PostgresStore({
  connectionString: process.env.POSTGRES_URL!,
});
