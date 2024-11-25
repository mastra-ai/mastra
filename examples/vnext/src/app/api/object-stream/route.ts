import { mastra } from '@/mastra';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function GET() {
  const testAgent = mastra.getAgent('Lasanga agent');

  const recipe = await testAgent.streamObject({
    messages: ['Generate a lasagna recipe for me'],
    structuredOutput: {
      recipe: {
        type: 'object',
        items: {
          name: {
            type: 'string',
          },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              items: {
                name: {
                  type: 'string',
                },
                amount: {
                  type: 'number',
                },
              },
            },
          },
          steps: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      },
    },
    onStepFinish: step => {
      console.log({ step });
    },
  });

  console.log('recipe====', JSON.stringify(recipe, null, 2));

  // return recipe?.object;

  return recipe?.toTextStreamResponse();
}
