import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const getStockPrice = async (symbol: string) => {
  const data = await fetch(`https://mastra-stock-data.vercel.app/api/stock-data?symbol=${symbol}`).then(r => r.json());
  return data.prices['4. close'];
};

const server = new Server(
  {
    name: 'Stock Price Server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const stockSchema = z.object({
  method: z.literal('getStockPrice'),
  symbol: z.string().describe('Stock symbol'),
});

server.setRequestHandler(stockSchema, async args => {
  try {
    console.log('Using tool to fetch stock price for', args.symbol);
    const price = await getStockPrice(args.symbol);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            symbol: args.symbol,
            currentPrice: price,
          }),
        },
      ],
      isError: false,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        content: [
          {
            type: 'text',
            text: `Stock price fetch failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: 'text',
          text: 'An unknown error occurred.',
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Stock Price MCP Server running on stdio');
}

export { runServer, server };
