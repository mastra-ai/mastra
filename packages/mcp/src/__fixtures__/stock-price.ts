import { FastMCP } from 'fastmcp';
import { z } from 'zod';

const getStockPrice = async (symbol: string) => {
  // Return mock data for testing
  return {
    symbol,
    currentPrice: '150.00',
  };
};

const server = new FastMCP({
  name: 'Stock Price Server',
  version: '1.0.0',
});

const stockSchema = z.object({
  symbol: z.string(),
});

server.addTool({
  name: 'getStockPrice',
  description: "Fetches the last day's closing stock price for a given symbol",
  parameters: stockSchema,
  execute: async (args: z.infer<typeof stockSchema>) => {
    try {
      const priceData = await getStockPrice(args.symbol);
      return JSON.stringify(priceData);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Stock price fetch failed: ${error.message}`);
      }
      throw error;
    }
  },
});

// Start the server with stdio transport
void server.start({
  transportType: 'stdio',
});

export { server };

