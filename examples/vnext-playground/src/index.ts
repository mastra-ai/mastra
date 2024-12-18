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

async function main() {
  const runId = 'testRunId';

  await mastra.sync(
    'testSync',
    {
      name: 'test',
    },
    runId,
  );

  const workflow = mastra.getWorkflow('helloWorklow');

  try {
    const run = await workflow.execute({
      triggerData: {
        name: 'test',
      },
    });
    console.log('run==', run);
  } catch (err) {
    console.error('workflow err==', err);
  }

  // await text();
}

main().catch(console.error);
