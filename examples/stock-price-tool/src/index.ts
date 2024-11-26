import { mastra } from './mastra';
import { stockPrices } from './tools';
 
async function main() {
  const stockAgent = mastra.getAgent('Stock Agent');
  const response = await stockAgent.text({
    messages: ['What is the current stock price of Apple (AAPL)?'],
  });
  console.log(response.text);
}
 
main();