import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// MCP App tools — shared between the MCPServer and the MCP Apps Agent
//
// Per the MCP Apps spec, tools with interactive UIs should return a brief
// summary in `content` (what the model sees) rather than the full answer.
// The actual computation happens in the UI via callServerTool, and the UI
// can send follow-up messages via sendMessage.
export const calculatorWithUI = createTool({
  id: 'calculatorWithUI',
  description:
    'Opens an interactive calculator UI. The user can enter numbers, choose an operation, and compute results directly in the UI.',
  inputSchema: z.object({
    num1: z.number().describe('First operand'),
    num2: z.number().describe('Second operand'),
    operation: z.enum(['add', 'subtract']).describe('Operation to perform'),
  }),
  mcp: {
    _meta: { ui: { resourceUri: 'ui://calculator/app' } },
  },
  execute: async ({ num1, num2, operation }) => {
    const result = operation === 'add' ? num1 + num2 : num1 - num2;
    return `${num1} ${operation === 'add' ? '+' : '−'} ${num2} = ${result}`;
  },
});

export const greetUserWithUI = createTool({
  id: 'greetUserWithUI',
  description: 'Opens an interactive greeting UI where the user can enter a name and generate personalized greetings.',
  inputSchema: z.object({
    name: z.string().describe('Name of the person to greet'),
  }),
  mcp: {
    _meta: { ui: { resourceUri: 'ui://greeting/app' } },
  },
  execute: async ({ name }) => {
    return `Interactive greeting app displayed for ${name}. The user can modify the name and generate new greetings directly in the UI.`;
  },
});
