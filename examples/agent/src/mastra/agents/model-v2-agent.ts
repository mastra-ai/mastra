import { Agent } from '@mastra/core/agent';
import { openai, openai as openai_v5 } from '@ai-sdk/openai-v5';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { lessComplexWorkflow, myWorkflow } from '../workflows';
import { Memory } from '@mastra/memory';
import { ModerationProcessor } from '@mastra/core/processors';
import { logDataMiddleware } from '../../model-middleware';
import { APICallError, wrapLanguageModel } from 'ai-v5';
import { cookingTool } from '../tools';

export const weatherInfo = createTool({
  id: 'weather-info',
  description: 'Fetches the current weather information for a given city',
  inputSchema: z.object({
    city: z.string(),
  }),
  execute: async inputData => {
    return {
      city: inputData.city,
      weather: 'sunny',
      temperature_celsius: 19,
      temperature_fahrenheit: 66,
      humidity: 50,
      wind: '10 mph',
    };
  },
  // requireApproval: true,
});

const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
    },
  },
});

const testAPICallError = new APICallError({
  message: 'Test API error',
  url: 'https://test.api.com',
  requestBodyValues: { test: 'test' },
  statusCode: 401,
  isRetryable: false,
  responseBody: 'Test API error response',
});

export const chefModelV2Agent = new Agent({
  id: 'chef-model-v2-agent',
  name: 'Chef Agent V2 Model',
  description: 'A chef agent that can help you cook great meals with whatever ingredients you have available.',
  instructions: {
    content: `
      You are Michel, a practical and experienced home chef who helps people cook great meals with whatever
      ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes.
      You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
      `,
    role: 'system',
  },
  model: wrapLanguageModel({
    model: openai_v5('gpt-4o-mini'),
    middleware: logDataMiddleware,
  }),

  tools: {
    weatherInfo,
    cookingTool,
  },
  workflows: {
    myWorkflow,
    lessComplexWorkflow,
  },
  scorers: ({ mastra }) => {
    if (!mastra) {
      throw new Error('Mastra not found');
    }
    const scorer1 = mastra.getScorerById('scorer1');

    return {
      scorer1: { scorer: scorer1, sampling: { rate: 1, type: 'ratio' } },
    };
  },
  memory,
  inputProcessors: [
    new ModerationProcessor({
      model: openai('gpt-4.1-nano'),
      categories: ['hate', 'harassment', 'violence'],
      threshold: 0.7,
      strategy: 'block',
      instructions: 'Detect and flag inappropriate content in user messages',
    }),
  ],
});

const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent',
  instructions: `Your goal is to execute the recipe-maker workflow with the given ingredient`,
  description: `An agent that can help you get a recipe for a given ingredient`,
  model: openai_v5('gpt-4o-mini'),
  tools: {
    weatherInfo,
  },
  workflows: {
    myWorkflow,
  },
});

export const networkAgent = new Agent({
  id: 'network-agent',
  name: 'Chef Network',
  description:
    'A chef agent that can help you cook great meals with whatever ingredients you have available based on your location and current weather.',
  instructions: `You are a the manager of several agent, tools, and workflows. Use the best primitives based on what the user wants to accomplish your task.`,
  model: openai_v5('gpt-4o-mini'),
  agents: {
    weatherAgent,
  },
  // workflows: {
  //   myWorkflow,
  // },
  // tools: {
  //   weatherInfo,
  // },
  memory,
});
