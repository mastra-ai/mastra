import { Mastra } from '@mastra/core';

import { stockAgent } from './agents';
import * as tools from './tools';

export const mastra = new Mastra({
  tools,
  agents: [stockAgent],
});

async function main() {
  const stockAgent = mastra.getAgent('Stock Agent');
  const response = await stockAgent.text({
    messages: ['What is the current stock price of Apple (AAPL)?'],
  });

  const toolCall: any = response.toolResults.find((result: any) => result.toolName === 'stockPrices');

  const currentPrice = toolCall?.result?.currentPrice;

  console.log(`The current price of Apple (AAPL) is $${currentPrice}`);
}

main();
