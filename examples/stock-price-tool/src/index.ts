import { mastra } from './mastra';
import { stockPrices } from './tools';

async function main() {
  const stockAgent = mastra.getAgent('Stock Agent');
  const response = await stockAgent.text({
    messages: ['What is the current stock price of Apple (AAPL)?'],
  });

  // console.log({ responseText: response.text, response: JSON.stringify(response, null, 2) });

  const toolCall: any = response.toolResults.find((result: any) => result.toolName === 'stockPrices');

  // console.log({ toolCall: JSON.stringify(toolCall, null, 2) });

  const currentPrice = toolCall?.result?.currentPrice;

  console.log(`The current price of Apple (AAPL) is $${currentPrice}`);
}

main();
