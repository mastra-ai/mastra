import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const cookingTool = createTool({
  id: 'cooking-tool',
  description: 'My tool description',
  inputSchema: z.object({}),
  execute: async () => {
    console.log('My tool is running!');
    return 'My tool result';
  },
});
