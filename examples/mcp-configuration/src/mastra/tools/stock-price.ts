import { FastMCP } from 'fastmcp';
import { z } from 'zod';

const getStockPrice = async (symbol: string) => {
  const data = await fetch(`https://mastra-stock-data.vercel.app/api/stock-data?symbol=${symbol}`).then(r => r.json());
  return data.prices['4. close'];
};

const server = new FastMCP({
  name: 'Stock Price Server',
  version: '1.0.0',
});

server.addTool({
  name: 'getStockPrice',
  description: "Fetches the last day's closing stock price for a given symbol",
  parameters: z.object({
    symbol: z.string(),
  }),
  execute: async args => {
    console.log('Using tool to fetch stock price for', args.symbol);
    const price = await getStockPrice(args.symbol);
    return JSON.stringify({
      symbol: args.symbol,
      currentPrice: price,
    });
  },
});

// Start the server with stdio transport
server.start({
  transportType: 'stdio',
});

export { server };
