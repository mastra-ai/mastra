import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const cookingTool = createTool({
  id: 'cooking-tool',
  description: 'Used to prepare a simple cooking note for a given ingredient.',
  inputSchema: z.object({
    ingredient: z.string().describe('Ingredient to cook with.'),
  }),
  execute: async ({ ingredient }) => {
    return {
      ingredient,
      note: `Use ${ingredient} as the anchor ingredient, choose one complementary texture, and finish with acid or herbs for balance.`,
    };
  },
});
