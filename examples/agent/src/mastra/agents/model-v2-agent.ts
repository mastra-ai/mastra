import { Agent } from '@mastra/core/agent';
import { openai as openai_v5 } from '@ai-sdk/openai-v5';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { cookingTool } from '../tools';
import { myWorkflow } from '../workflows';
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { openai } from '@ai-sdk/openai';

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

const memory = new Memory({
  storage: new LibSQLStore({
    url: 'file:../../memory.db', // relative path from the `.mastra/output` directory
  }), // Storage for message history
  vector: new LibSQLVector({
    connectionUrl: 'file:../../vector.db', // relative path from the `.mastra/output` directory
  }), // Vector database for semantic search
  embedder: openai.embedding('text-embedding-3-small'), // Embedder for message embeddings
  options: {
    lastMessages: 10, // Include the last 20 messages in the context
    semanticRecall: {
      topK: 3, // Retrieve 3 most similar messages
      messageRange: 2, // Include 2 messages before and after each match
      scope: 'resource', // Search across all threads for this user
    },
    // Enable working memory to remember user information
    workingMemory: {
      enabled: true,
      template: `<user>
         <first_name></first_name>
         <username></username>
         <preferences></preferences>
         <interests></interests>
         <conversation_style></conversation_style>
       </user>`,
    },
  },
});

export const chefModelV2Agent = new Agent({
  name: 'Chef Agent V2 Model',
  description: 'A chef agent that can help you cook great meals with whatever ingredients you have available.',
  instructions: `
      YOU MUST USE THE TOOL cooking-tool
      You are Michel, a practical and experienced home chef who helps people cook great meals with whatever
      ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes.
      You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
      `,
  model: 'netlify/openai/gpt-4.1',
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

const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: `You are a weather agent that can help you get weather information for a given city`,
  description: `An agent that can help you get weather information for a given city`,
  model: openai_v5('gpt-4o-mini'),
  workflows: {
    myWorkflow,
  },
});

export const networkAgent = new Agent({
  name: 'Chef Network',
  description:
    'A chef agent that can help you cook great meals with whatever ingredients you have available based on your location and current weather.',
  instructions: `You are a the manager of several agent, tools, and workflows. Use the best primitives based on what the user wants to accomplish your task.`,
  model: openai_v5('gpt-4o-mini'),
  agents: {
    weatherAgent,
  },
  memory,
});
