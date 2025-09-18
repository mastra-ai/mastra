import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const cookingTool = createTool({
  id: 'cooking-tool',
  description: 'Used to cook given an ingredient',
  inputSchema: z.object({
    ingredient: z.string(),
  }),
  execute: async ({ context, writer }, options) => {
    console.log('My cooking tool is running!', context.ingredient);
    if (options?.toolCallId) {
      console.log('Cooking tool call ID:', options.toolCallId);
    }

    await writer?.write({
      type: 'custom-event',
      status: 'success',
      payload: {
        message: 'First shoot',
      },
    });

    await writer?.write({
      type: 'custom-event',
      status: 'success',
      payload: {
        message: 'second shoot',
      },
    });

    return 'Something great';
  },
});
