import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/store-pg';
import { createCryptoAgent } from './agents';

const connectionString = process.env.POSTGRES_URL!;

const memory = new Memory({
  storage: new PostgresStore({
    connectionString,
  }),
});

export const createMastra = ({
  modelProvider,
  modelName,
}: {
  modelProvider: string;
  modelName: string;
}) =>
  new Mastra({
    memory,
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
