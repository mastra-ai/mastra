import { FastMCP } from 'fastmcp';
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

const server = new FastMCP({
  name: 'Weather Server',
  version: '1.0.0',
});

const weatherSchema = z.object({
  location: z.string().describe('City name'),
});

server.addTool({
  name: 'getWeather',
  description: 'Get current weather for a location',
  parameters: weatherSchema,
  execute: async (args: z.infer<typeof weatherSchema>) => {
    try {
      const weatherData = await getWeather(args.location);
      return JSON.stringify(weatherData);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Weather fetch failed: ${error.message}`);
      }
      throw error;
    }
  },
});

// Start the server with SSE support
void server.start({
  transportType: 'sse',
  sse: {
    endpoint: '/sse',
    port: 8080,
  },
});

export { server };

