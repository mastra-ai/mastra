import { createTool } from '@mastra/core/tools';

export const calculatorTool = createTool({
  id: 'calculator',
  description: 'A tool that sums up 2 numbers',
  execute: async ({ context }) => {
    const { a, b } = context;
    return a + b;
  },
});
