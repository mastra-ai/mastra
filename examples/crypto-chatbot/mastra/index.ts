import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';
import { createCryptoAgent } from './agents';

export const createMastra = ({
  modelProvider,
  modelName,
}: {
  modelProvider: string;
  modelName: string;
}) =>
  new Mastra({
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
