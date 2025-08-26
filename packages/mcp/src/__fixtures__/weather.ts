import type { IncomingMessage, ServerResponse } from 'http';
import { createServer } from 'http';
import { createTool } from '@mastra/core/tools';
import type { Prompt, PromptMessage, Resource, ResourceTemplate } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { MCPServer } from '../server/server';
import type { MCPServerResources, MCPServerResourceContent, MCPServerPrompts } from '../server/types';

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

const serverId = 'weather-server-fixture';
console.log(`[${serverId}] Initializing`);

const weatherInputSchema = z.object({
  location: z.string().describe('City name'),
});

const weatherToolDefinition = createTool({
  id: 'getWeather',
  description: 'Get current weather for a location',
  inputSchema: weatherInputSchema,
  execute: async ({ context }) => {
    try {
      const weatherData = await getWeather(context.location);
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
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Weather fetch failed: ${message}`,
          },
        ],
        isError: true,
      };
    }
  },
});

const weatherResourceDefinitions: Resource[] = [
  {
    uri: 'weather://current',
    name: 'Current Weather Data',
    description: 'Real-time weather data for the current location',
    mimeType: 'application/json',
  },
  {
    uri: 'weather://forecast',
    name: 'Weather Forecast',
    description: '5-day weather forecast',
    mimeType: 'application/json',
  },
  {
    uri: 'weather://historical',
    name: 'Historical Weather Data',
    description: 'Weather data from the past 30 days',
    mimeType: 'application/json',
  },
];

const weatherResourceTemplatesDefinitions: ResourceTemplate[] = [
  {
    uriTemplate: 'weather://custom/{city}/{days}',
    name: 'Custom Weather Forecast',
    description: 'Generates a custom weather forecast for a city and number of days.',
    mimeType: 'application/json',
  },
];

const weatherResourceContents: Record<string, MCPServerResourceContent> = {
  'weather://current': {
    text: JSON.stringify({
      location: 'San Francisco',
      temperature: 18,
      conditions: 'Partly Cloudy',
      humidity: 65,
      windSpeed: 12,
      updated: new Date().toISOString(),
    }),
  },
  'weather://forecast': {
    text: JSON.stringify([
      { day: 1, high: 19, low: 12, conditions: 'Sunny' },
      { day: 2, high: 22, low: 14, conditions: 'Clear' },
      { day: 3, high: 20, low: 13, conditions: 'Partly Cloudy' },
      { day: 4, high: 18, low: 11, conditions: 'Rain' },
      { day: 5, high: 17, low: 10, conditions: 'Showers' },
    ]),
  },
  'weather://historical': {
    text: JSON.stringify({
      averageHigh: 20,
      averageLow: 12,
      rainDays: 8,
      sunnyDays: 18,
      recordHigh: 28,
      recordLow: 7,
    }),
  },
};

const weatherPrompts: Prompt[] = [
  {
    name: 'current',
    version: 'v1',
    description: 'Get current weather for a location',
    mimeType: 'application/json',
    content: JSON.stringify({
      location: 'Current weather for San Francisco',
    }),
  },
  {
    name: 'forecast',
    version: 'v1',
    description: 'Get weather forecast for a location',
    mimeType: 'application/json',
    content: JSON.stringify({
      location: 'Forecast for San Francisco',
    }),
  },
  {
    name: 'historical',
    version: 'v1',
    description: 'Get historical weather data for a location',
    mimeType: 'application/json',
    content: JSON.stringify({
      location: 'Historical weather for San Francisco',
    }),
  },
];

const mcpServerResources: MCPServerResources = {
  listResources: async () => weatherResourceDefinitions,
  getResourceContent: async ({ uri }: { uri: string }) => {
    if (weatherResourceContents[uri]) {
      return weatherResourceContents[uri];
    }
    throw new Error(`Mock resource content not found for ${uri}`);
  },
  resourceTemplates: async () => weatherResourceTemplatesDefinitions,
};

const mcpServerPrompts: MCPServerPrompts = {
  listPrompts: async () => weatherPrompts,
  getPromptMessages: async ({ name }: { name: string }): Promise<PromptMessage[]> => {
    const prompt = weatherPrompts.find(p => p.name === name);
    if (!prompt) {
      throw new Error(`Mock prompt not found for ${name}`);
    }
    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: prompt.content as string,
        },
      },
    ];
  },
};

const mcpServer = new MCPServer({
  name: serverId,
  version: '1.0.0',
  tools: {
    getWeather: weatherToolDefinition,
  },
  resources: mcpServerResources,
  prompts: mcpServerPrompts,
});

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const connectionLogPrefix = `[${serverId}] REQ: ${req.method} ${url.pathname}`;
  console.log(connectionLogPrefix);

  await mcpServer.startSSE({
    url,
    ssePath: '/sse',
    messagePath: '/message',
    req,
    res,
  });
});

const PORT = process.env.WEATHER_SERVER_PORT || 60808;
console.log(`[${serverId}] Starting HTTP server on port ${PORT}`);
httpServer.listen(PORT, () => {
  console.log(`[${serverId}] Weather server is running on SSE at http://localhost:${PORT}`);
});

// --- Interval-based Notifications ---
const NOTIFICATION_INTERVAL_MS = 1500;
let resourceUpdateCounter = 0;

const notificationInterval = setInterval(async () => {
  // Simulate resource update for weather://current
  resourceUpdateCounter++;
  const newCurrentWeatherText = JSON.stringify({
    location: 'San Francisco',
    temperature: 18 + (resourceUpdateCounter % 5), // Vary temperature slightly
    conditions: resourceUpdateCounter % 2 === 0 ? 'Sunny' : 'Partly Cloudy',
    humidity: 65 + (resourceUpdateCounter % 3),
    windSpeed: 12 + (resourceUpdateCounter % 4),
    updated: new Date().toISOString(),
  });
  weatherResourceContents['weather://current'] = { text: newCurrentWeatherText };

  const updatePrefix = `[${serverId}] IntervalUpdate`;
  try {
    await mcpServer.resources.notifyUpdated({ uri: 'weather://current' });
  } catch (e: any) {
    console.error(`${updatePrefix} - Error sending resourceUpdated for weather://current via MCPServer: ${e.message}`);
  }

  // Simulate resource list changed (less frequently, e.g., every 3rd interval)
  if (resourceUpdateCounter % 3 === 0) {
    const listChangePrefix = `[${serverId}] IntervalListChange`;
    try {
      await mcpServer.resources.notifyListChanged();
    } catch (e: any) {
      console.error(`${listChangePrefix} - Error sending resourceListChanged via MCPServer: ${e.message}`);
    }
  }
}, NOTIFICATION_INTERVAL_MS);

const promptNotificationInterval = setInterval(async () => {
  const listChangePrefix = `[${serverId}] IntervalListChange`;
  try {
    await mcpServer.prompts.notifyListChanged();
  } catch (e: any) {
    console.error(`${listChangePrefix} - Error sending promptListChanged via MCPServer: ${e.message}`);
  }
}, NOTIFICATION_INTERVAL_MS);
// --- End Interval-based Notifications ---

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down weather server...');
  clearInterval(notificationInterval); // Clear the interval
  clearInterval(promptNotificationInterval); // Clear the interval
  await mcpServer.close();
  httpServer.close(() => {
    console.log('Weather server shut down complete');
    process.exit(0);
  });
});

export { mcpServer as server };
