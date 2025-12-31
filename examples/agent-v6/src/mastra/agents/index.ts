import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { stepCountIs, ToolLoopAgent } from 'ai';
import { openai } from '@ai-sdk/openai';
import { weatherInfo, weatherTool } from '../tools';
import { SkillsProcessor } from '@mastra/knowledge';

const memory = new Memory();

export const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent v6',
  instructions: `Your goal is to provide weather information for cities when requested`,
  description: `An agent that can help you get weather information for a given city`,
  model: openai('gpt-4o-mini'),
  inputProcessors: [new SkillsProcessor()],
  tools: {
    weatherInfo,
  },
  memory,
});

// AI SDK ToolLoopAgent
export const weatherToolLoopAgent = new ToolLoopAgent({
  model: openai('gpt-4o-mini'),
  instructions: 'You are a helpful weather assistant. Use the weather tool to get current conditions.',
  stopWhen: stepCountIs(1),
  tools: {
    weather: weatherTool,
  },
  // temperature: 0.7,
  // maxRetries: 2,
  // stopWhen: stepCountIs(1),
  // prepareCall: async args => {
  //   console.log('prepareCall', args);
  //   return args;
  // },
  // prepareStep: args => {
  //   console.log('prepareStep', args);
  //   return args;
  // },
  // onStepFinish: event => {
  //   console.log('onStepFinish', event);
  // },
  // onFinish: event => {
  //   console.log('onFinish', event);
  // },
});
