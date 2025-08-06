import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { jsonSchema, tool } from 'ai';
import { OpenAIVoice } from '@mastra/voice-openai';
import { Memory } from '@mastra/memory';
import { Agent, InputProcessor } from '@mastra/core/agent';
import { cookingTool } from '../tools/index.js';
import { myWorkflow } from '../workflows/index.js';
import {
  PIIDetector,
  LanguageDetector,
  PromptInjectionDetector,
  ModerationInputProcessor,
} from '@mastra/core/agent/input-processor/processors';
import { MCPClient } from '@mastra/mcp';

const memory = new Memory();

// Define schema directly compatible with OpenAI's requirements
const mySchema = jsonSchema({
  type: 'object',
  properties: {
    city: {
      type: 'string',
      description: 'The city to get weather information for',
    },
  },
  required: ['city'],
});

export const weatherInfo = tool({
  description: 'Fetches the current weather information for a given city',
  parameters: mySchema,
  execute: async ({ city }) => {
    return {
      city,
      weather: 'sunny',
      temperature_celsius: 19,
      temperature_fahrenheit: 66,
      humidity: 50,
      wind: '10 mph',
    };
  },
});

export const chefAgent = new Agent({
  name: 'Chef Agent',
  description: 'A chef agent that can help you cook great meals with whatever ingredients you have available.',
  instructions: `
    YOU MUST USE THE TOOL cooking-tool
    You are Michel, a practical and experienced home chef who helps people cook great meals with whatever 
    ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes. 
    You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
    `,
  model: openai('gpt-4o-mini'),
  tools: {
    cookingTool,
    weatherInfo,
  },
  workflows: {
    myWorkflow,
  },
  memory,
  voice: new OpenAIVoice(),
});

export const dynamicAgent = new Agent({
  name: 'Dynamic Agent',
  instructions: ({ runtimeContext }) => {
    if (runtimeContext.get('foo')) {
      return 'You are a dynamic agent';
    }
    return 'You are a static agent';
  },
  model: ({ runtimeContext }) => {
    if (runtimeContext.get('foo')) {
      return openai('gpt-4o');
    }
    return openai('gpt-4o-mini');
  },
  tools: ({ runtimeContext }) => {
    const tools = {
      cookingTool,
    };

    if (runtimeContext.get('foo')) {
      tools['web_search_preview'] = openai.tools.webSearchPreview();
    }

    return tools;
  },
});

const vegetarianProcessor: InputProcessor = {
  name: 'eat-more-tofu',
  process: async ({ messages }) => {
    messages.push({
      id: crypto.randomUUID(),
      createdAt: new Date(),
      role: 'user',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Make the suggested recipe, but remove any meat and add tofu instead' }],
      },
    });

    return messages;
  },
};

const piiDetector = new PIIDetector({
  model: google('gemini-2.0-flash-001'),
  redactionMethod: 'mask',
  preserveFormat: true,
  includeDetections: true,
});

const languageDetector = new LanguageDetector({
  model: google('gemini-2.0-flash-001'),
  targetLanguages: ['en'],
  strategy: 'translate',
});

const promptInjectionDetector = new PromptInjectionDetector({
  model: google('gemini-2.0-flash-001'),
  strategy: 'block',
});

const moderationDetector = new ModerationInputProcessor({
  model: google('gemini-2.0-flash-001'),
  strategy: 'block',
});

export const chefAgentResponses = new Agent({
  name: 'Chef Agent Responses',
  instructions: `
    You are Michel, a practical and experienced home chef who helps people cook great meals with whatever 
    ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes. 
    You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
    `,
  model: openai.responses('gpt-4o'),
  tools: async () => {
    return {
      web_search_preview: openai.tools.webSearchPreview(),
    };
  },
  workflows: {
    myWorkflow,
  },
  inputProcessors: [
    // piiDetector,
    // vegetarianProcessor,
    languageDetector,
    // promptInjectionDetector,
    // moderationDetector,
    {
      name: 'no-soup-for-you',
      process: async ({ messages, abort }) => {
        const hasSoup = messages.some(msg => {
          for (const part of msg.content.parts) {
            if (part.type === 'text' && part.text.includes('soup')) {
              return true;
            }
          }
          return false;
        });

        if (hasSoup) {
          abort('No soup for you!');
        }

        return messages;
      },
    },
    {
      name: 'remove-spinach',
      process: async ({ messages }) => {
        for (const message of messages) {
          for (const part of message.content.parts) {
            if (part.type === 'text' && part.text.includes('spinach')) {
              part.text = part.text.replaceAll('spinach', '');
            }
          }
        }

        return messages;
      },
    },
  ],
});
