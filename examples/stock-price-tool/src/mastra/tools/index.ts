import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const getStockPrice = async (symbol: string) => {
  const data = await fetch(`https://mastra-stock-data.vercel.app/api/stock-data?symbol=${symbol}`).then(r => r.json());
  return data.prices['4. close'];
};

export const stockPrices = createTool({
  id: 'Get Stock Price',
  inputSchema: z.object({
    symbol: z.string(),
  }),
  description: `Fetches the last day's closing stock price for a given symbol`,
  execute: async ({ context }) => {
    console.log('Using tool to fetch stock price for', context.symbol);
    return {
      symbol: context.symbol,
      currentPrice: await getStockPrice(context.symbol),
    };
  },
});
