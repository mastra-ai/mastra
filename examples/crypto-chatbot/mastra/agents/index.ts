import { Agent } from '@mastra/core/agent';
import { systemPrompt } from '@/ai/prompts';
import {
  getCryptoPrice,
  getHistoricalCryptoPrices,
  searchCryptoCoins,
} from '../tools';

export const createCryptoAgent = (modelProvider: any, modelName: any) => {
  return new Agent({
    name: 'cryptoAgent',
    instructions: systemPrompt,
    model: {
      provider: modelProvider,
      name: modelName,
      toolChoice: 'auto',
    },
    tools: {
      searchCryptoCoins,
      getCryptoPrice,
      getHistoricalCryptoPrices,
    },
  });
};
