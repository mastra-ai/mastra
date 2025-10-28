import { z } from 'zod';
import { z as zv4 } from 'zod/v4';
import { createTool } from './src/tools/tool';

// Test with Zod v4
const v4Tool = createTool({
  id: 'test-tool',
  description: 'Reverse the input string',
  inputSchema: zv4.object({
    input: zv4.string(),
  }),
  outputSchema: zv4.object({
    output: zv4.string(),
  }),
  execute: async ({ context }) => {
    const { input } = context;
    const reversed = input.split('').reverse().join('');
    return {
      output: reversed,
    };
  },
});

// Test with Zod v3
const v3Tool = createTool({
  id: 'v3-tool',
  description: 'Tool with v3 schemas',
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ context }) => ({
    result: context.message.toUpperCase(),
  }),
});

export { v3Tool, v4Tool };
