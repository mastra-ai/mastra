import { z } from 'zod';
import { mastra } from './mastra';

const agent = mastra.getAgent('chefAgent');

async function writeToStdout(textStream) {
  console.log(`\n👨‍🍳 Chef Michel: `);

  for await (const chunk of textStream) {
    // Use only process.stdout.write to create a continuous stream
    process.stdout.write(chunk);
  }

  console.log('\n\n✅ Recipe complete!');
}

async function main() {
  const query1 =
    'In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make?';
  const pastaResponse = await agent.generate(query1);
  console.log('\n👨‍🍳 Chef Michel:', pastaResponse.text);

  const query2 =
    "I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.";
  const { textStream } = await agent.stream(query2);

  await writeToStdout(textStream);

  const query3 = 'I want to make lasagna, can you generate a lasagna recipe for me?';
  const lasagnaResponse = await agent.generate(query3, {
    output: z.object({
      ingredients: z.array(
        z.object({
          name: z.string(),
          amount: z.number(),
        }),
      ),
      steps: z.array(z.string()),
    }),
  });

  console.log('\n👨‍🍳 Chef Michel:', lasagnaResponse.object);
  console.log('\n-------------------\n');

  const lasagnaResponseJsonSchema = await agent.generate(query3, {
    output: {
      type: 'object',
      additionalProperties: false,
      required: ['ingredients', 'steps'],
      properties: {
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              amount: { type: 'number' },
            },
            required: ['name', 'amount'],
          },
        },
        steps: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  });

  console.log('\n👨‍🍳 Chef Michel:', lasagnaResponseJsonSchema.object);
  console.log('\n-------------------\n');

  const lasagnaExperimentalResponse = await agent.generate(query3, {
    experimental_output: z.object({
      ingredients: z.array(
        z.object({
          name: z.string(),
          amount: z.number(),
        }),
      ),
      steps: z.array(z.string()),
    }),
  });
  console.log('\n👨‍🍳 Chef Michel:', lasagnaExperimentalResponse.object);
  console.log('\n-------------------\n');

  const { textStream: lasagnaStreamResponse } = await agent.stream(query2, {
    experimental_output: z.object({
      ingredients: z.array(
        z.object({
          name: z.string(),
          amount: z.number(),
        }),
      ),
      steps: z.array(z.string()),
    }),
  });

  await writeToStdout(lasagnaStreamResponse);
}

main();
