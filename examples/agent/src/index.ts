import { z } from 'zod';

import { mastra } from './mastra';

const agent = mastra.getAgent('chefAgent');

async function text() {
  // Query 1: Basic pantry ingredients
  const query1 =
    'In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make?';
  console.log(`Query 1: ${query1}`);

  const pastaResponse = await agent.generate(query1);
  console.log('\n👨‍🍳 Chef Michel:', pastaResponse.text);
  console.log('\n-------------------\n');
}

async function generateText() {
  // Query 1: Basic pantry ingredients

  const query1 =
    'In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make?';
  console.log(`Query 1: ${query1}`);

  const pastaResponse = await agent.generate(query1);

  console.log('\n👨‍🍳 Chef Michel:', pastaResponse.text);
  console.log('\n-------------------\n');
}

async function textStream() {
  // Query 2: More ingredients
  const query2 =
    "Now I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.";
  console.log(`Query 2: ${query2}`);

  const curryResponse = await agent.stream(query2);

  console.log('\n👨‍🍳 Chef Michel: ');

  // Handle the stream
  for await (const chunk of curryResponse.textStream) {
    // Write each chunk without a newline to create a continuous stream
    process.stdout.write(chunk);
  }

  console.log('\n\n✅ Recipe complete!');
}

async function generateStream() {
  // Query 2: More ingredients
  const query2 =
    "Now I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.";
  console.log(`Query 2: ${query2}`);

  const curryResponse = await agent.stream([query2]);

  console.log('\n👨‍🍳 Chef Michel: ');

  // Handle the stream
  for await (const chunk of curryResponse.textStream) {
    // Write each chunk without a newline to create a continuous stream
    process.stdout.write(chunk);
  }

  console.log('\n\n✅ Recipe complete!');
}

async function textObject() {
  // Query 3: Generate a lasagna recipe
  const query3 = 'I want to make lasagna, can you generate a lasagna recipe for me?';
  console.log(`Query 3: ${query3}`);

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
}

async function textObjectJsonSchema() {
  // Query 3: Generate a lasagna recipe
  const query3 = 'I want to make lasagna, can you generate a lasagna recipe for me?';
  console.log(`Query 3: ${query3}`);

  const lasagnaResponse = await agent.generate(query3, {
    output: {
      type: 'object',
      properties: {
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              amount: { type: 'number' },
            },
          },
        },
        steps: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  });

  console.log('\n👨‍🍳 Chef Michel:', lasagnaResponse.object);
  console.log('\n-------------------\n');
}

async function generateObject() {
  // Query 3: Generate a lasagna recipe
  const query3 = 'I want to make lasagna, can you generate a lasagna recipe for me?';
  console.log(`Query 3: ${query3}`);

  const lasagnaResponse = await agent.generate([query3], {
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
}

async function streamObject() {
  // Query 4: Generate a lasagna recipe
  const query4 = 'I want to make lasagna, can you generate a lasagna recipe for me?';
  console.log(`Query 4: ${query4}`);

  const lasagnaStreamResponse = await agent.stream(query4, {
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

  console.log('\n👨‍🍳 Chef Michel: ');

  // Handle the stream
  for await (const chunk of lasagnaStreamResponse.textStream) {
    // Write each chunk without a newline to create a continuous stream
    process.stdout.write(chunk);
  }

  console.log('\n\n✅ Recipe complete!');
}

async function generateStreamObject() {
  // Query 4: Generate a lasagna recipe
  const query4 = 'I want to make lasagna, can you generate a lasagna recipe for me?';
  console.log(`Query 4: ${query4}`);

  const lasagnaStreamResponse = await agent.stream([query4], {
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

  console.log('\n👨‍🍳 Chef Michel: ');

  // Handle the stream
  for await (const chunk of lasagnaStreamResponse.textStream) {
    // Write each chunk without a newline to create a continuous stream
    process.stdout.write(chunk);
  }

  console.log('\n\n✅ Recipe complete!');
}

async function main() {
  await text();

  await generateText();

  await textStream();

  await generateStream();

  await textObject();

  await textObjectJsonSchema();

  await generateObject();

  await streamObject();

  await generateStreamObject();
}

main();
