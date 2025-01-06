'use server';

import { z } from 'zod';

import { mastra } from '@/mastra';

export async function testText(messages: string[]) {
  const agent = mastra.getAgent('agentOne');
  console.log({ messages });

  const streamResult = await agent?.generate(messages, {
    onStepFinish: step => {
      console.log({ step });
    },
  });

  console.log({ streamResult: JSON.stringify(streamResult) });

  return streamResult?.text;
}

export async function testStructuredOutput() {
  const lasagnaAgent = mastra.getAgent('lasagnaAgent');

  const recipe = await lasagnaAgent.generate('Generate a lasagna recipe for me', {
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
  return {
    message: 'Hello',
  };
}
