import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const cookingTool = createTool({
  id: 'cooking-tool',
  description: 'Used to cook given an ingredient',
  inputSchema: z.object({
    ingredient: z.string(),
  }),
  requestContextSchema: z.object({
    userId: z.string(),
  }),
  execute: async (inputData, context) => {
    // Access validated userId from request context
    const userId = context?.requestContext?.get('userId');
    console.log(`[cookingTool] Processing ingredient "${inputData.ingredient}" for user: ${userId}`);

    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('My cooking tool is running!', inputData.ingredient);
    if (context?.agent?.toolCallId) {
      console.log('Cooking tool call ID:', context.agent.toolCallId);
    }
    return 'My tool result';
  },
});
