'use server';

import { mastra } from '@/mastra';

export async function testText(messages: string[]) {
  const agent = mastra.getAgent('Agent One');
  console.log({ messages });

  const streamResult = await agent?.text({
    messages,
    onStepFinish: step => {
      console.log({ step });
    },
  });

  console.log({ streamResult: JSON.stringify(streamResult) });

  return streamResult?.text;
}

export async function testStructuredOutput() {
  const testAgent = mastra.getAgent('Lasanga agent');

  const recipe = await testAgent.textObject({
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
  });

  return recipe?.object;
}

export async function testSync() {
  const syncResult = await mastra.sync('mySync', {
    name: 'John Doe',
    foo: 'bar',
    createdAt: new Date(),
  });

  console.log({ syncResult });
  return syncResult;
}

export async function testTool() {
  const tesTool = mastra.getTool('testTool');

  const res = await tesTool.execute({
    name: 'test',
    message: 'hello',
  });

  console.log({
    res,
  });

  return res;
}
