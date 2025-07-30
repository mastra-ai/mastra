import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export function calculate(a: number, b: number) {
  return a + b;
}

export const calculatorTool = createTool({
  id: 'calculator',
  description: 'A tool that sums up 2 numbers',
  inputSchema: z.object({
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ context }) => {
    const { a, b } = context;
    return calculate(a, b);
  },
});
