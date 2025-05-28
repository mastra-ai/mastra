import { openai } from '@ai-sdk/openai';
import { jsonSchema, tool } from 'ai';
import { OpenAIVoice } from '@mastra/voice-openai';
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { cookingTool } from '../tools/index.js';
import { myWorkflow } from '../workflows/index.js';
import type { CoreMessage } from 'ai';
import { z } from 'zod';

const memory = new Memory();

/**
 * Checks if a CoreMessage contains profanity or inappropriate language
 * @param message The message to check
 * @returns true if profanity is detected, false otherwise
 */
function hasProfanity(message: CoreMessage): boolean {
  // List of profanity words to check for
  const profanityList = [
    'damn',
    'hell',
    'ass',
    'shit',
    'fuck',
    'bitch',
    'crap',
    'bastard',
    'dick',
    'piss',
    'cunt',
    'whore',
    'slut',
    'asshole',
    'motherfucker',
  ];

  // Check string content
  if (typeof message.content === 'string') {
    const contentLower = message.content.toLowerCase();
    return profanityList.some(word => {
      // Use word boundary to match whole words only
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(contentLower);
    });
  }
  // Check array content (can contain text parts)
  else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === 'text' && typeof part.text === 'string') {
        const textLower = part.text.toLowerCase();
        if (
          profanityList.some(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            return regex.test(textLower);
          })
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

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

export const chefAgentResponses = new Agent({
  name: 'Chef Agent',
  instructions: `
    You are Michel, a practical and experienced home chef who helps people cook great meals with whatever 
    ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes. 
    You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
    `,
  model: openai.responses('gpt-4o'),
  tools: {
    web_search_preview: openai.tools.webSearchPreview(),
  },
});

export const questionEnhancer = new Agent({
  name: 'Question Enhancer',
  instructions: `
    You are a question enhancer. You take a question and enhance it to make it more specific and detailed.
  `,
  model: openai('gpt-4o-mini'),
});

export const promptRelevancyEnhancer = new Agent({
  name: 'Prompt Relevancy Enhancer',
  instructions: ({ runtimeContext }) => {
    const topic = runtimeContext.get('topic');
    console.log(topic);
    return `
      You are a prompt relevancy enhancer. 
      Based on the topic ${topic}, let us know if the prompt is relevant to the topic.

      {
        "relevant": boolean,
        "reason": string
      }
    `;
  },
  model: openai('gpt-4o-mini'),
});

export const tutorAgent = new Agent({
  name: 'Tutor Agent',
  instructions: `
    You are a tutor who helps students learn new skills.
  `,
  model: openai('gpt-4o-mini'),
  inputProcessors: [
    async ({ messages, mastra, runtimeContext }) => {
      const promptRelevancyAgent = mastra.getAgent('promptRelevancyEnhancer');

      const relevancyResponse = await promptRelevancyAgent.generate(messages[messages.length - 1].content, {
        runtimeContext,
        output: z.object({
          relevant: z.boolean(),
          reason: z.string(),
        }),
      });

      if (!relevancyResponse.object.relevant) {
        throw new Error(`Prompt is not relevant to the topic. Reason: ${relevancyResponse.object.reason}`);
      }

      return messages;
    },

    async ({ messages }) => {
      // Check for profanity in messages
      for (const message of messages) {
        if (hasProfanity(message)) {
          throw new Error('Message contains inappropriate language. Please maintain a respectful tone.');
        }
      }
      return messages;
    },

    async ({ messages, mastra }) => {
      const questionEnhancerAgent = mastra.getAgent('questionEnhancer');

      const questionEnhancerResponse = await questionEnhancerAgent.generate(messages[messages.length - 1].content);

      messages[messages.length - 1].content = questionEnhancerResponse.text;

      return messages;
    },
  ],
});
