import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const getStockPrice = async (symbol: string) => {
  // Return mock data for testing
  return {
    symbol,
    currentPrice: '150.00',
  };
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
    const priceData = await getStockPrice(args.symbol);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(priceData),
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
