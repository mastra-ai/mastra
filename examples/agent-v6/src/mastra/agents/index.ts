import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { weatherInfo } from '../tools';
import { ToolSearchProcessor } from '../processors/tool-search-processor';

const memory = new Memory();

export const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent v6',
  instructions: `Your goal is to provide weather information for cities when requested`,
  description: `An agent that can help you get weather information for a given city`,
  model: openai('gpt-4o-mini'),
  inputProcessors: [new ToolSearchProcessor({ tools: { weatherInfo } })],
  memory,
});
