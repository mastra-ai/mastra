import { PostgresStore } from '@mastra/pg';
import { mastra } from './typed-mastra';

export const vectorStore: PostgresStore = new PostgresStore({ connectionString: process.env.DATABASE_URL as string });

export { mastra };
