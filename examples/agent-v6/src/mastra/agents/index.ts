import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
// import { myWorkflow } from '../workflows/index.js';
// import { weatherInfo } from '../tools/index.js';

const memory = new Memory();

export const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent',
  instructions: `Your goal is to execute the recipe-maker workflow with the given ingredient`,
  description: `An agent that can help you get a recipe for a given ingredient`,
  model: openai('gpt-4o-mini'),
  // model: 'openai/gpt-4o-mini',
  // tools: {
  //   weatherInfo,
  // },
  // workflows: {
  //   myWorkflow,
  // },
  memory,
});
