import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { systemPrompt } from '@/ai/prompts';
import {
  getCryptoPrice,
  getHistoricalCryptoPrices,
  searchCryptoCoins,
} from '../tools';

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
    tools: {
      searchCryptoCoins,
      getCryptoPrice,
      getHistoricalCryptoPrices,
    },
  });
};
