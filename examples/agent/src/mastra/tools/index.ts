import { createTool } from '@mastra/core';
import { z } from 'zod';

export const myTool = createTool({
  id: 'my-tool',
  description: 'My tool description',
  inputSchema: z.object({}),
  execute: async () => {
    console.log('My tool is running!');
  },
});
