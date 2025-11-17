import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const cookingTool = createTool({
  id: 'cooking-tool',
  description: 'Used to cook given an ingredient',
  inputSchema: z.object({
    ingredient: z.string(),
  }),
  execute: async (inputData, context) => {
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('My cooking tool is running!', inputData.ingredient);
    if (context?.agent?.toolCallId) {
      console.log('Cooking tool call ID:', context.agent.toolCallId);
    }
    return 'My tool result';
  },
});
