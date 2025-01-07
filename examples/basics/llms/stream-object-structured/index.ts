import { Mastra } from '@mastra/core';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

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

const result = await llm.stream('Generate a egusi recipe.', {
  output: recipeSchema,
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
