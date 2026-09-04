import { Server } from '@modelcontextprotocol/server';
import type { Tool } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod/v3';
import zodToJsonSchema from 'zod-to-json-schema';

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

const stockInputSchema = z.object({
  symbol: z.string().describe('Stock symbol'),
});

const stockTool = {
  name: 'getStockPrice',
  description: "Fetches the last day's closing stock price for a given symbol",
  execute: async (args: z.infer<typeof stockInputSchema>) => {
    try {
      const priceData = await getStockPrice(args.symbol);
      return {
        content: [
          {
            type: 'text' as const,
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
              type: 'text' as const,
              text: `Stock price fetch failed: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: 'An unknown error occurred.',
          },
        ],
        isError: true,
      };
    }
  },
};

// Set up request handlers
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: stockTool.name,
      description: stockTool.description,
      inputSchema: zodToJsonSchema(stockInputSchema) as Tool['inputSchema'],
    },
  ],
}));

server.setRequestHandler('tools/call', async request => {
  try {
    switch (request.params.name) {
      case 'getStockPrice': {
        const args = stockInputSchema.parse(request.params.arguments);
        return await stockTool.execute(args);
      }
      default:
        return {
          content: [
            {
              type: 'text' as const,
              text: `Unknown tool: ${request.params.name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Invalid arguments: ${error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);

export { server };
