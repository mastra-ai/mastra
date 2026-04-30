import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// MCP App tools — shared between the MCPServer and the MCP Apps Agent
export const calculatorWithUI = createTool({
  id: 'calculatorWithUI',
  description: 'Calculator with an interactive MCP App UI. Performs add or subtract.',
  inputSchema: z.object({
    num1: z.number().describe('First operand'),
    num2: z.number().describe('Second operand'),
    operation: z.enum(['add', 'subtract']).describe('Operation to perform'),
  }),
  mcp: {
    _meta: { ui: { resourceUri: 'ui://calculator/app' } },
  },
  execute: async ({ num1, num2, operation }) => {
    if (operation === 'add') return num1 + num2;
    if (operation === 'subtract') return num1 - num2;
    throw new Error('Invalid operation');
  },
});

export const greetUserWithUI = createTool({
  id: 'greetUserWithUI',
  description: 'Generates a personalized greeting with an interactive MCP App UI.',
  inputSchema: z.object({
    name: z.string().describe('Name of the person to greet'),
  }),
  mcp: {
    _meta: { ui: { resourceUri: 'ui://greeting/app' } },
  },
  execute: async ({ name }) => {
    return `Hello, ${name}! Welcome to MCP Apps.`;
  },
});
