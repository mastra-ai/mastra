import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { weatherInfo } from '../tools';
import { ToolSearchProcessor } from '../processors/tool-search-processor';

const memory = new Memory();

export const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent',
  instructions: `Your goal is to execute the recipe-maker workflow with the given ingredient`,
  description: `An agent that can help you get a recipe for a given ingredient`,
  model: openai('gpt-4o-mini'),
  inputProcessors: [new ToolSearchProcessor({ tools: { weatherInfo } })],
  memory,
});
