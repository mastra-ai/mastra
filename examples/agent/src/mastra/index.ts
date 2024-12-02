import { Mastra } from '@mastra/core';

import { chefAgent } from './agents';

// When you register an agent with Mastra, they get access to the logger and any configured tools or integrations, as we will explore in the following sections.

export const mastra = new Mastra({
  agents: [chefAgent],
});

async function main() {
  // Query 1: Basic pantry ingredients

  const query1 =
    'In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make?';
  console.log(`Query: ${query1}`);

  const pastaResponse = await chefAgent.text({
    messages: [query1],
  });
  console.log('\n👨‍🍳 Chef Michel:', pastaResponse.text);
  console.log('\n-------------------\n');

  // Query 2: More ingredients
  const query2 =
    "Now I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.";
  console.log(`Query: ${query2}`);

  const curryResponse = await chefAgent.stream({
    messages: [query2],
  });

  console.log('\n👨‍🍳 Chef Michel: ');

  // Handle the stream
  for await (const chunk of curryResponse.textStream) {
    // Write each chunk without a newline to create a continuous stream
    process.stdout.write(chunk);
  }

  console.log('\n\n✅ Recipe complete!');

  // Query 3: Generate a lasagna recipe
  const query3 = 'I want to make lasagna, can you generate a lasagna recipe for me?';
  console.log(`Query: ${query3}`);

  const lasagnaResponse = await chefAgent.textObject({
    messages: [query3],
    structuredOutput: {
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
  });
  console.log('\n👨‍🍳 Chef Michel:', lasagnaResponse.object);
  console.log('\n-------------------\n');

  const query4 = 'I want to make lasagna, can you generate a lasagna recipe for me?';
  console.log(`Query: ${query4}`);

  const lasagnaStreamResponse = await chefAgent.streamObject({
    messages: [query4],
    structuredOutput: {
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
  });

  console.log('\n👨‍🍳 Chef Michel: ');

  // Handle the stream
  for await (const chunk of lasagnaStreamResponse.textStream) {
    // Write each chunk without a newline to create a continuous stream
    process.stdout.write(chunk);
  }

  console.log('\n\n✅ Recipe complete!');
}

main();
