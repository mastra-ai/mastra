import { createLogger, Mastra } from '@mastra/core';
import { PgMemory } from '@mastra/memory';
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
      type: 'CONSOLE',
      level: 'DEBUG',
    }),
  });

export const mastra = createMastra({
  modelProvider: 'ANTHROPIC',
  modelName: 'claude-3-haiku-20240307',
});
