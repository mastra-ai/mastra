import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { stepCountIs, ToolLoopAgent } from 'ai';
import { openai } from '@ai-sdk/openai';
import { weatherTool } from '../tools';

const memory = new Memory();

export const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent v6',
  instructions: `Your goal is to provide weather information for cities when requested`,
  description: `An agent that can help you get weather information for a given city`,
  model: openai('gpt-4o-mini'),
  // tools: { weatherInfo },
  memory,
  // defaultOptions: {
  //   onStepFinish: event => {
  //     console.log('onStepFinish', event);
  //   },
  //   onFinish: event => {
  //     console.log('onFinish', event);
  //   },
  //   onChunk: chunk => {
  //     console.log('onChunk', chunk);
  //   },
  //   onError: error => {
  //     console.log('onError', error);
  //   },
  //   onAbort: event => {
  //     console.log('onAbort', event);
  //   },
  // },

  // defaultOptions: {
  //   // maxSteps: 5,
  //   stopWhen: ({ steps }) => {
  //     console.log('stopWhen', steps);
  //     return false;
  //   },
  // },
});

// Create an AI SDK ToolLoopAgent
export const weatherToolLoopAgent = new ToolLoopAgent({
  // id: 'weather-tool-loop-agent',
  model: openai('gpt-4o-mini'),
  instructions: 'You are a helpful weather assistant. Use the weather tool to get current conditions.',
  tools: {
    weather: weatherTool,
  },
  temperature: 0.7,
  maxRetries: 2,
  stopWhen: stepCountIs(1),
  prepareCall: async args => {
    // prepareCall --> maybe can map to processInput
    console.log('prepareCall', args);
    return args;
  },
  prepareStep: args => {
    //  -> can use intermediary processor to map this to our prepareStep / processInputStep with correct args/returns
    console.log('prepareStep', args);
    return args;
  },
  onStepFinish: event => {
    console.log('onStepFinish', event);
  },
  onFinish: event => {
    console.log('onFinish', event);
  },
});
