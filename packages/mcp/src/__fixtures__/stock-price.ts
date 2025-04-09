import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

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
  },
};

// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: stockTool.name,
      description: stockTool.description,
      inputSchema: zodToJsonSchema(stockInputSchema),
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async request => {
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
              type: 'text',
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
            type: 'text',
            text: `Invalid arguments: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: 'text',
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
