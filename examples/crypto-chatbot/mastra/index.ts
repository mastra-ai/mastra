import { Mastra } from '@mastra/core';
import { PgMemory } from '@mastra/memory';
import { createCryptoAgent } from './agents';
import * as tools from './tools';

const connectionString = 'postgresql://postgres:postgres@localhost:5433';
const pgMemory = new PgMemory(connectionString);

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
