import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const getWeather = async (location: string) => {
  // Return mock data for testing
  return {
    temperature: 20,
    feelsLike: 18,
    humidity: 65,
    windSpeed: 10,
    windGust: 15,
    conditions: 'Clear sky',
    location,
  };
};

const server = new Server(
  {
    name: 'Weather Server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const weatherInputSchema = z.object({
  location: z.string().describe('City name'),
});

const weatherTool = {
  name: 'getWeather',
  description: 'Get current weather for a location',
  execute: async (args: z.infer<typeof weatherInputSchema>) => {
    try {
      const weatherData = await getWeather(args.location);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(weatherData),
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
              text: `Weather fetch failed: ${error.message}`,
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
      name: weatherTool.name,
      description: weatherTool.description,
      inputSchema: zodToJsonSchema(weatherInputSchema),
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async request => {
  try {
    switch (request.params.name) {
      case 'getWeather': {
        const args = weatherInputSchema.parse(request.params.arguments);
        return await weatherTool.execute(args);
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
