import { z } from 'zod';

import { mastra } from '@/mastra';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function GET() {
  const testAgent = mastra.getAgent('lasagnaAgent');

  const recipe = await testAgent.stream('Generate a lasagna recipe for me', {
    output: z.object({
      recipe: z.object({
        name: z.string(),
        ingredients: z.array(
          z.object({
            name: z.string(),
            amount: z.number(),
          }),
        ),
        steps: z.array(z.string()),
      }),
    }),
    onStepFinish: step => {
      console.log({ step });
    },
  });

  console.log('recipe====', JSON.stringify(recipe, null, 2));

  return recipe?.toTextStreamResponse();
}
