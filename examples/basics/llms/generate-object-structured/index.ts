import { Mastra } from '@mastra/core';
import { z } from 'zod';

const mastra = new Mastra();

const llm = mastra.LLM({
  provider: 'OPEN_AI',
  name: 'gpt-4o',
});

const recipeSchema = z.object({
  recipe: z.object({
    name: z.string(),
    ingredients: z.array(
      z.object({
        name: z.string(),
        amount: z.string(),
      }),
    ),
    steps: z.array(z.string()),
  }),
});

const result = await llm.generate('Generate a egusi recipe.', {
  output: recipeSchema,
});

console.log(JSON.stringify(result.object.recipe, null, 2));
