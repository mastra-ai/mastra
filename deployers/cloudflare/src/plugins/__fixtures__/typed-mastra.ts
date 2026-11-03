import type { Config } from '@mastra/core/mastra';
import { Mastra } from '@mastra/core/mastra';
import { PostgresStore } from '@mastra/pg';

interface Env {
  DATABASE_URL: string;
}

const env = process.env as unknown as Env;

const config: Config = {
  storage: new PostgresStore({ connectionString: env.DATABASE_URL }),
};

export const mastra: Mastra = new Mastra(config) satisfies Mastra;
