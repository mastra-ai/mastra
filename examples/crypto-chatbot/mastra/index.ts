import { createLogger, Mastra } from '@mastra/core';
import { PgMemory } from '@mastra/memory/postgres';
import { createCryptoAgent } from './agents';

const connectionString = process.env.POSTGRES_URL!;
const pgMemory = new PgMemory({ connectionString });

export const createMastra = ({
  modelProvider,
  modelName,
}: {
  modelProvider: string;
  modelName: string;
}) =>
  new Mastra({
    memory: pgMemory,
    agents: { cryptoAgent: createCryptoAgent(modelProvider, modelName) },
    logger: createLogger({
      name: 'CONSOLE',
      level: 'debug',
    }),
  });

export const mastra = createMastra({
  modelProvider: 'OPEN_AI',
  modelName: 'gpt-4o-mini',
});
