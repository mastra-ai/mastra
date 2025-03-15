import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

import { stockPrices } from '../tools/stock-price';

export const stockAgent = new Agent({
  name: 'Stock Agent',
  instructions:
    'You are a helpful assistant that provides current stock prices. When asked about a stock, use the stock price tool to fetch the stock price.',
  model: openai('gpt-4o'),
  tools: {
    stockPrices,
  },
});
