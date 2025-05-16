import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { z } from 'zod';

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
  },
});
