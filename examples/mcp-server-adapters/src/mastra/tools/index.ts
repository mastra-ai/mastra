import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Weather tool - simulates getting weather for a location
 */
export const weatherTool = createTool({
  id: 'getWeather',
  description: 'Gets the current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('The location to get weather for'),
  }),
  execute: async ({ location }) => {
    // Simulated weather data
    return {
      temperature: 72,
      condition: `Sunny in ${location}`,
      humidity: 45,
      windSpeed: 10,
    };
  },
});

/**
 * Calculator tool - performs basic math operations
 */
export const calculatorTool = createTool({
  id: 'calculate',
  description: 'Performs basic calculations',
  inputSchema: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ operation, a, b }) => {
    if (operation === 'divide' && b === 0) {
      throw new Error('Cannot divide by zero');
    }
    let result = 0;
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        result = a / b;
        break;
    }
    return { result, operation, operands: { a, b } };
  },
});

/**
 * Echo tool - simple tool that echoes back input
 */
export const echoTool = createTool({
  id: 'echo',
  description: 'Echoes back the provided message',
  inputSchema: z.object({
    message: z.string().describe('The message to echo'),
  }),
  execute: async ({ message }) => {
    return { echo: message, timestamp: new Date().toISOString() };
  },
});
