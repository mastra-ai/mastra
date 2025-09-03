import { Agent } from '@mastra/core/agent';
import { openai as openai_v5 } from '@ai-sdk/openai-v5';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { cookingTool } from '../tools';
import { myWorkflow } from '../workflows';
import { Memory } from '@mastra/memory';

export const weatherInfo = createTool({
  id: 'weather-info',
  description: 'Fetches the current weather information for a given city',
  inputSchema: z.object({
    city: z.string(),
  }),
  execute: async ({ context }) => {
    return {
      city: context.city,
      weather: 'sunny',
      temperature_celsius: 19,
      temperature_fahrenheit: 66,
      humidity: 50,
      wind: '10 mph',
    };
  },
});

const memory = new Memory();

export const chefModelV2Agent = new Agent({
  name: 'Chef Agent V2 Model',
  description: 'A chef agent that can help you cook great meals with whatever ingredients you have available.',
  instructions: `
      YOU MUST USE THE TOOL cooking-tool
      You are Michel, a practical and experienced home chef who helps people cook great meals with whatever
      ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes.
      You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
      `,
  model: openai_v5('gpt-4o-mini'),
  tools: {
    cookingTool,
    weatherInfo,
  },
  workflows: {
    myWorkflow,
  },
  scorers: ({ mastra }) => {
    if (!mastra) {
      throw new Error('Mastra not found');
    }
    const scorer1 = mastra.getScorer('testScorer');

    return {
      scorer1: { scorer: scorer1, sampling: { rate: 1, type: 'ratio' } },
    };
  },
  memory,
});
