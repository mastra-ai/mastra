import { createTool } from '@mastra/core/tools';
import { MCPServer, MCPServerResources } from '@mastra/mcp';
import { z } from 'zod';
import { chefAgent } from '../agents';
import { myWorkflow } from '../workflows';

// Resources implementation
const weatherResources: MCPServerResources = {
  listResources: async () => {
    return [
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
  },
  getResourceContent: async ({ uri }) => {
    if (uri === 'weather://current') {
      return [
        {
          text: JSON.stringify({
            location: 'San Francisco',
            temperature: 18,
            conditions: 'Partly Cloudy',
            humidity: 65,
            windSpeed: 12,
            updated: new Date().toISOString(),
          }),
        },
      ];
    } else if (uri === 'weather://forecast') {
      return [
        {
          text: JSON.stringify([
            { day: 1, high: 19, low: 12, conditions: 'Sunny' },
            { day: 2, high: 22, low: 14, conditions: 'Clear' },
            { day: 3, high: 20, low: 13, conditions: 'Partly Cloudy' },
            { day: 4, high: 18, low: 11, conditions: 'Rain' },
            { day: 5, high: 17, low: 10, conditions: 'Showers' },
          ]),
        },
      ];
    } else if (uri === 'weather://historical') {
      return [
        {
          text: JSON.stringify({
            averageHigh: 20,
            averageLow: 12,
            rainDays: 8,
            sunnyDays: 18,
            recordHigh: 28,
            recordLow: 7,
          }),
        },
      ];
    }

    throw new Error(`Resource not found: ${uri}`);
  },
  resourceTemplates: async () => {
    return [
      {
        uriTemplate: 'weather://custom/{city}/{days}',
        name: 'Custom Weather Forecast',
        description: 'Generates a custom weather forecast for a city and number of days.',
        mimeType: 'application/json',
      },
      {
        uriTemplate: 'weather://alerts?region={region}&level={level}',
        name: 'Weather Alerts',
        description: 'Get weather alerts for a specific region and severity level.',
        mimeType: 'application/json',
      },
    ];
  },
};

export const myMcpServer = new MCPServer({
  name: 'My Calculation & Data MCP Server',
  version: '1.0.0',
  tools: {
    calculator: createTool({
      id: 'calculator',
      description: 'Performs basic arithmetic operations (add, subtract).',
      inputSchema: z.object({
        num1: z.number().describe('The first number.'),
        num2: z.number().describe('The second number.'),
        operation: z.enum(['add', 'subtract']).describe('The operation to perform.'),
      }),
      execute: async ({ context }) => {
        const { num1, num2, operation } = context;
        if (operation === 'add') {
          return num1 + num2;
        }
        if (operation === 'subtract') {
          return num1 - num2;
        }
        throw new Error('Invalid operation');
      },
    }),
    fetchWeather: createTool({
      id: 'fetchWeather',
      description: 'Fetches a (simulated) weather forecast for a given city.',
      inputSchema: z.object({
        city: z.string().describe('The city to get weather for, e.g., London, Paris.'),
      }),
      execute: async ({ context }) => {
        const { city } = context;
        const temperatures = {
          london: '15°C',
          paris: '18°C',
          tokyo: '22°C',
        };
        const temp = temperatures[city.toLowerCase() as keyof typeof temperatures] || '20°C';
        return `The weather in ${city} is ${temp} and sunny.`;
      },
    }),
  },
});

export const myMcpServerTwo = new MCPServer({
  name: 'My Utility MCP Server',
  version: '1.0.0',
  agents: { chefAgent },
  workflows: { myWorkflow },
  resources: weatherResources,
  tools: {
    stringUtils: createTool({
      id: 'stringUtils',
      description: 'Performs utility operations on strings (uppercase, reverse).',
      inputSchema: z.object({
        text: z.string().describe('The input string.'),
        action: z.enum(['uppercase', 'reverse']).describe('The string action to perform.'),
      }),
      execute: async ({ context }) => {
        const { text, action } = context;
        if (action === 'uppercase') {
          return text.toUpperCase();
        }
        if (action === 'reverse') {
          return text.split('').reverse().join('');
        }
        throw new Error('Invalid string action');
      },
    }),
    greetUser: createTool({
      id: 'greetUser',
      description: 'Generates a personalized greeting.',
      inputSchema: z.object({
        name: z.string().describe('The name of the person to greet.'),
      }),
      execute: async ({ context }) => {
        return `Hello, ${context.name}! Welcome to the MCP server.`;
      },
    }),
    collectContactInfo: createTool({
      id: 'collectContactInfo',
      description: 'Collects user contact information through elicitation.',
      inputSchema: z.object({
        reason: z.string().optional().describe('Optional reason for collecting contact info'),
      }),
      execute: async ({ context }, options) => {
        const { reason } = context;

        try {
          // Use the session-aware elicitation functionality
          const result = await options.elicitation.sendRequest({
            message: reason
              ? `Please provide your contact information. ${reason}`
              : 'Please provide your contact information',
            requestedSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  title: 'Full Name',
                  description: 'Your full name',
                },
                email: {
                  type: 'string',
                  title: 'Email Address',
                  description: 'Your email address',
                  format: 'email',
                },
                phone: {
                  type: 'string',
                  title: 'Phone Number',
                  description: 'Your phone number (optional)',
                },
              },
              required: ['name', 'email'],
            },
          });

          if (result.action === 'accept') {
            return `Thank you! Contact information collected: ${JSON.stringify(result.content, null, 2)}`;
          } else if (result.action === 'reject') {
            return 'Contact information collection was declined by the user.';
          } else {
            return 'Contact information collection was cancelled by the user.';
          }
        } catch (error) {
          return `Error collecting contact information: ${error}`;
        }
      },
    }),
  },
});

/**
 * Simulates an update to the content of 'weather://current'.
 * In a real application, this would be called when the underlying data for that resource changes.
 */
export const simulateCurrentWeatherUpdate = async () => {
  console.log('[Example] Simulating update for weather://current');
  // If you have access to the server instance that uses these resources (e.g., myMcpServerTwo)
  // you would call its notification method.
  await myMcpServerTwo.resources.notifyUpdated({ uri: 'weather://current' });
  console.log('[Example] Notification sent for weather://current update.');
};

/**
 * Simulates a change in the list of available weather resources (e.g., a new forecast type becomes available).
 * In a real application, this would be called when the overall list of resources changes.
 */
export const simulateResourceListChange = async () => {
  console.log('[Example] Simulating a change in the list of available weather resources.');
  // This would typically involve updating the actual list returned by `listResources`
  // and then notifying the server.
  // For this example, we'll just show the notification part.
  await myMcpServerTwo.resources.notifyListChanged();
  console.log('[Example] Notification sent for resource list change.');
};
