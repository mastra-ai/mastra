import { Mastra } from '@mastra/core';
import dotenv from 'dotenv';

import { weatherAgent } from './agents';

dotenv.config();

const mastra = new Mastra({
  agents: { weatherAgent },
});

async function main() {
  const agent = await mastra.getAgent('weatherAgent');
  const result = await agent.generate('What is the weather in London?');
  console.log(result.text);
}

main();
