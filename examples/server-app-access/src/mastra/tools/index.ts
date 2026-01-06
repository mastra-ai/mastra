import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Calculator tool - performs basic arithmetic operations
 */
export const calculatorTool = createTool({
  id: 'calculator',
  description: 'Performs basic arithmetic operations',
  inputSchema: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ operation, a, b }) => {
    if (operation === 'divide' && b === 0) {
      throw new Error('Cannot divide by zero');
    }

    let result: number;
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
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }

    return { result, operation, operands: { a, b } };
  },
});

/**
 * Timestamp tool - returns current timestamp in various formats
 */
export const timestampTool = createTool({
  id: 'timestamp',
  description: 'Returns the current timestamp in various formats',
  inputSchema: z.object({
    format: z.enum(['iso', 'unix', 'readable']).default('iso'),
  }),
  execute: async ({ format }) => {
    const now = new Date();

    let timestamp: string;
    switch (format) {
      case 'unix':
        timestamp = Math.floor(now.getTime() / 1000).toString();
        break;
      case 'readable':
        timestamp = now.toLocaleString();
        break;
      case 'iso':
      default:
        timestamp = now.toISOString();
        break;
    }

    return { timestamp, format };
  },
});
