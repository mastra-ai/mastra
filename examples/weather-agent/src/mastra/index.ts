import { Mastra } from '@mastra/core';

import { weatherAgent } from './agents';

const mastra = new Mastra({
  agents: { weatherAgent },
});

async function main() {
  const agent = await mastra.getAgent('weatherAgent');
  const result = await agent.generate('What is the weather in London?');
  console.log(result.text);
}

main();
