import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

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

const weatherSchema = z.object({
  method: z.literal('getWeather'),
  location: z.string().describe('City name'),
});

server.setRequestHandler(weatherSchema, async args => {
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
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Weather MCP Server running on stdio');
}

export { runServer, server };
