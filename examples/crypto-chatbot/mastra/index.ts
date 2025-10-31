import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
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
    logger: new PinoLogger({
      name: 'CONSOLE',
      level: 'debug',
    }),
  });

export const mastra = createMastra({
  modelProvider: 'OPEN_AI',
  modelName: 'gpt-4o-mini',
});
