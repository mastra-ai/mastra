import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const getStockPrice = async (symbol: string) => {
  const response = await fetch(`https://mastra-stock-data.vercel.app/api/stock-data?symbol=${symbol}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch stock price for ${symbol}: ${response.status} ${errorText}`);
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(
      `Failed to parse JSON response for ${symbol}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!data.prices || !data.prices['4. close']) {
    throw new Error(`Invalid response format for symbol ${symbol}: ${JSON.stringify(data)}`);
  }

  return data.prices['4. close'];
};

export const stockPrices = createTool({
  id: 'Get Stock Price',
  inputSchema: z.object({
    symbol: z.string(),
  }),
  description: `Fetches the last day's closing stock price for a given symbol`,
  execute: async (inputData, context) => {
    console.log('Using tool to fetch stock price for', inputData.symbol);
    return {
      symbol: inputData.symbol,
      currentPrice: await getStockPrice(inputData.symbol),
    };
  },
});
