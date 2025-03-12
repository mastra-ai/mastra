import { Mastra } from '@mastra/core';

import { weatherAgent } from './agents';
import { weatherWorkflow } from './workflows';

export const mastra = new Mastra({
  agents: { weatherAgent },
  workflows: { weatherWorkflow },
});

async function agentExample() {
  const agent = await mastra.getAgent('weatherAgent');
  const result = await agent.generate('What is the weather in London?');
  console.log(result.text);
}

async function workflowExample() {
  const { start } = mastra.getWorkflow('weatherWorkflow').createRun();

  const result = await start({
    triggerData: {
      city: 'London',
    },
  });

  console.log('\n \n');
  console.log(result);
}

// agentExample();
// workflowExample();
