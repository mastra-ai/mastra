import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const cookingTool = createTool({
  id: 'cooking-tool',
  description: 'Used to cook given an ingredient',
  inputSchema: z.object({
    ingredient: z.string(),
  }),
  execute: async ({ context }, options) => {
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('My cooking tool is running!', context.ingredient);
    if (options?.toolCallId) {
      console.log('Cooking tool call ID:', options.toolCallId);
    }
    return 'My tool result';
  },
});
