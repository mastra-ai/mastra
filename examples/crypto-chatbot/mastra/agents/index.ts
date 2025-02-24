import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { openai } from '@ai-sdk/openai';
import { systemPrompt } from '@/ai/prompts';
import {
  getCryptoPrice,
  getHistoricalCryptoPrices,
  searchCryptoCoins,
} from '../tools';

const connectionString = process.env.POSTGRES_URL!;

const memory = new Memory({
  storage: new PostgresStore({
    connectionString,
  }),
});

export const createCryptoAgent = (modelProvider: any, modelName: any) => {
  let model;
  if (modelProvider === 'OPEN_AI') {
    model = openai(modelName);
  }

  if (!model) {
    throw new Error('Model not found');
  }

  return new Agent({
    name: 'cryptoAgent',
    instructions: systemPrompt,
    model,
    memory,
    tools: {
      searchCryptoCoins,
      getCryptoPrice,
      getHistoricalCryptoPrices,
    },
  });
};
