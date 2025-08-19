import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const cookingTool = createTool({
  id: 'cooking-tool',
  description: 'My cooking tool description',
  inputSchema: z.object({
    ingredient: z.string(),
  }),
  execute: async ({ context }, options) => {
    console.log('My cooking tool is running!', context.ingredient);
    if (options?.toolCallId) {
      console.log('Cooking tool call ID:', options.toolCallId);
    }
    return 'My tool result';
  },
});
