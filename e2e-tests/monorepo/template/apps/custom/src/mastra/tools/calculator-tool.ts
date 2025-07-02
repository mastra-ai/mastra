import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const calculatorTool = createTool({
  id: 'calculator',
  description: 'A tool that sums up 2 numbers',
  inputSchema: z.object({
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ context }) => {
    const { a, b } = context;
    return a + b;
  },
});
