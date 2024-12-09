import { Agent } from '@mastra/core';

import * as tools from '../tools';

export const stockAgent = new Agent<typeof tools>({
  name: 'Stock Agent',
  instructions:
    'You are a helpful assistant that provides current stock prices. When asked about a stock, use the stock price tool to fetch the stock price.',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
    toolChoice: 'required',
  },
  enabledTools: {
    stockPrices: true,
  },
});
