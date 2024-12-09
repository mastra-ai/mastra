import { Agent } from '@mastra/core';
import { systemPrompt } from '@/ai/prompts';

export const createCryptoAgent = (modelProvider: any, modelName: any) => {
  return new Agent({
    name: 'cryptoAgent',
    instructions: systemPrompt,
    model: {
      provider: modelProvider,
      name: modelName,
      toolChoice: 'auto',
    },
    enabledTools: {
      searchCryptoCoins: true,
      getCryptoPrice: true,
      getHistoricalCryptoPrices: true,
    },
  });
};
