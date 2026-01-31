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
  execute: async (inputData, { requestContext }) => {
    const userId = requestContext?.get('userId');
    console.log('My cooking tool is running!', inputData.ingredient, userId);
    return `My tool result: ${inputData.ingredient} from ${userId}`;
  },
});
