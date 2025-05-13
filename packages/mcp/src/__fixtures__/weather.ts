import type { IncomingMessage, ServerResponse } from 'http';
import { createServer } from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema, 
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
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
      resources: {}
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

// Resources implementation
const weatherResources = [
  {
    uri: 'weather://current',
    name: 'Current Weather Data',
    description: 'Real-time weather data for the current location',
    mimeType: 'application/json'
  },
  {
    uri: 'weather://forecast',
    name: 'Weather Forecast',
    description: '5-day weather forecast',
    mimeType: 'application/json'
  },
  {
    uri: 'weather://historical',
    name: 'Historical Weather Data',
    description: 'Weather data from the past 30 days',
    mimeType: 'application/json'
  }
];

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: weatherResources
}));

// Read resource contents
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  
  if (uri === 'weather://current') {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            location: 'San Francisco',
            temperature: 18,
            conditions: 'Partly Cloudy',
            humidity: 65,
            windSpeed: 12,
            updated: new Date().toISOString()
          })
        }
      ]
    };
  } else if (uri === 'weather://forecast') {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify([
            { day: 1, high: 19, low: 12, conditions: 'Sunny' },
            { day: 2, high: 22, low: 14, conditions: 'Clear' },
            { day: 3, high: 20, low: 13, conditions: 'Partly Cloudy' },
            { day: 4, high: 18, low: 11, conditions: 'Rain' },
            { day: 5, high: 17, low: 10, conditions: 'Showers' }
          ])
        }
      ]
    };
  } else if (uri === 'weather://historical') {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            averageHigh: 20,
            averageLow: 12,
            rainDays: 8,
            sunnyDays: 18,
            recordHigh: 28,
            recordLow: 7
          })
        }
      ]
    };
  }
  
  throw new Error(`Resource not found: ${uri}`);
});

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
let transport: SSEServerTransport | undefined;

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);

  if (url.pathname === '/sse') {
    console.log('Received SSE connection');
    transport = new SSEServerTransport('/message', res);
    await server.connect(transport);

    server.onclose = async () => {
      await server.close();
      transport = undefined;
    };

    // Handle client disconnection
    res.on('close', () => {
      transport = undefined;
    });
  } else if (url.pathname === '/message') {
    console.log('Received message');
    if (!transport) {
      res.writeHead(503);
      res.end('SSE connection not established');
      return;
    }
    await transport.handlePostMessage(req, res);
  } else {
    console.log('Unknown path:', url.pathname);
    res.writeHead(404);
    res.end();
  }
});

const PORT = process.env.PORT || 60808;
httpServer.listen(PORT, () => {
  console.log(`Weather server is running on SSE at http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down weather server...');
  if (transport) {
    await server.close();
    transport = undefined;
  }
  // Close the HTTP server
  httpServer.close(() => {
    console.log('Weather server shut down complete');
    process.exit(0);
  });
});

export { server };
