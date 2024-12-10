import { Mastra } from '@mastra/core';
import { PgMemory } from '@mastra/memory';
import { createCryptoAgent } from './agents';
import * as tools from './tools';

const connectionString = process.env.POSTGRES_URL!;
const pgMemory = new PgMemory({ connectionString });

export const createMastra = ({
  modelProvider,
  modelName,
}: {
  modelProvider: string;
  modelName: string;
}) =>
  new Mastra<any, typeof tools, any>({
    tools,
    memory: pgMemory,
    agents: [createCryptoAgent(modelProvider, modelName)],
  });

export const mastra = createMastra({
  modelProvider: 'OPEN_AI',
  modelName: 'gpt-4o-mini',
});
