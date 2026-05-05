import { openai } from '@ai-sdk/openai';
import { jsonSchema, tool } from 'ai';
import { z } from 'zod';
import { OpenAIVoice } from '@mastra/voice-openai';
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { cookingTool } from '../tools/index.js';
import { myWorkflow } from '../workflows/index.js';
import { calculatorWithUI, greetUserWithUI } from '../mcp/app-tools';
import { PIIDetector, LanguageDetector, PromptInjectionDetector, ModerationProcessor } from '@mastra/core/processors';
import { createAnswerRelevancyScorer } from '@mastra/evals/scorers/prebuilt';
import { requestContextDemoAgent } from './request-context-demo-agent';

// Export Dynamic Tools Agent
export { dynamicToolsAgent } from './dynamic-tools-agent.js';
export { slackDemoAgent } from './slack-agent.js';
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
  id: 'chef-agent',
  name: 'Chef Agent',
  description: 'A chef agent that can help you cook great meals with whatever ingredients you have available.',
  instructions: `
    YOU MUST USE THE TOOL cooking-tool
    You are Michel, a practical and experienced home chef who helps people cook great meals with whatever
    ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes.
    You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
    `,
  model: 'openai/gpt-5.4-mini',
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
  id: 'dynamic-agent',
  name: 'Dynamic Agent',
  instructions: ({ requestContext }) => {
    if (requestContext.get('foo')) {
      return 'You are a dynamic agent';
    }
    return 'You are a static agent';
  },
  model: ({ requestContext }) => {
    if (requestContext.get('foo')) {
      return 'openai/gpt-5.4' as const;
    }
    return 'openai/gpt-5.4-mini' as const;
  },
  tools: ({ requestContext }) => {
    const tools: Record<string, any> = {
      cookingTool,
    };

    if (requestContext.get('foo')) {
      tools['web_search_preview'] = openai.tools.webSearchPreview();
    }

    return tools;
  },
});

/**
 * Example demonstrating requestContextSchema for type-safe, validated request context.
 *
 * The requestContextSchema allows you to:
 * 1. Define required runtime context values upfront using Zod schemas
 * 2. Get automatic validation with clear error messages when validation fails
 * 3. Have the Playground UI show a schema-driven form instead of raw JSON editor
 *
 * This is useful when you want to ensure certain context values are always present
 * before the agent executes, like API keys, user IDs, feature flags, etc.
 */
export const schemaValidatedAgent = new Agent({
  id: 'schema-validated-agent',
  name: 'Schema Validated Agent',
  description: 'An agent that demonstrates requestContextSchema for type-safe request context validation',

  // Define the required request context values using a Zod schema
  requestContextSchema: z.object({
    userId: z.string().describe('The ID of the current user'),
    apiKey: z.string().describe('API key for external service access'),
    featureFlags: z
      .object({
        enableSearch: z.boolean().default(false).describe('Enable web search capabilities'),
        debugMode: z.boolean().default(false).describe('Enable debug logging'),
      })
      .optional()
      .describe('Optional feature flags'),
  }),

  instructions: ({ requestContext }) => {
    // Access validated context values with type safety
    const { userId, featureFlags } = requestContext.all;

    const baseInstructions = `You are a helpful assistant. The current user ID is: ${userId}.`;

    if (featureFlags?.debugMode) {
      return `${baseInstructions} Debug mode is enabled - provide verbose responses.`;
    }

    return baseInstructions;
  },

  model: 'openai/gpt-5.4-mini',

  tools: ({ requestContext }) => {
    const tools: Record<string, any> = {
      weatherInfo,
    };

    // Conditionally add tools based on validated feature flags
    const { featureFlags } = requestContext.all;
    if (featureFlags?.enableSearch) {
      tools['web_search_preview'] = openai.tools.webSearchPreview();
    }

    return tools;
  },
});

const piiDetector = new PIIDetector({
  model: 'openai/gpt-5.4',
  redactionMethod: 'mask',
  preserveFormat: true,
  includeDetections: true,
});

const languageDetector = new LanguageDetector({
  model: 'google/gemini-2.0-flash-001',
  targetLanguages: ['en'],
  strategy: 'translate',
});

const promptInjectionDetector = new PromptInjectionDetector({
  model: 'google/gemini-2.0-flash-001',
  strategy: 'block',
});

const moderationDetector = new ModerationProcessor({
  model: 'google/gemini-2.0-flash-001',
  strategy: 'block',
  chunkWindow: 10,
});

export const chefAgentResponses = new Agent({
  id: 'chef-agent-responses',
  name: 'Chef Agent Responses',
  instructions: `
    You are Michel, a practical and experienced home chef who helps people cook great meals with whatever
    ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes.
    You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
    `,
  model: 'openai/gpt-5.4',
  tools: async () => {
    return {
      web_search_preview: openai.tools.webSearchPreview(),
      cooking_tool: cookingTool,
    };
  },
  workflows: {
    myWorkflow,
  },
  inputProcessors: [
    piiDetector,
    // vegetarianProcessor,
    // languageDetector,
    // promptInjectionDetector,
    // moderationDetector,
  ],
});

export const agentThatHarassesYou = new Agent({
  id: 'agent-that-harasses-you',
  name: 'Agent That Harasses You',
  instructions: `
    You are a agent that harasses you. You are a jerk. You are a meanie. You are a bully. You are a asshole.
    `,
  model: 'openai/gpt-5.4',
  outputProcessors: [moderationDetector],
});

const answerRelevance = createAnswerRelevancyScorer({
  model: 'openai/gpt-5.4',
});

export const evalAgent = new Agent({
  id: 'eval-agent',
  name: 'Eval Agent',
  instructions: `
    You are a helpful assistant with a weather tool.
    `,
  model: 'openai/gpt-5.4',
  tools: {
    weatherInfo,
  },
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
      },
    },
  }),
  scorers: {
    answerRelevance: {
      scorer: answerRelevance,
    },
  },
});

export { requestContextDemoAgent };

// MCP Apps Demo Agent — tools are passed directly, not via mcpServers/mcpClients.
// The MCPServer is registered at the Mastra level for Studio resource resolution,
// while the agent simply consumes tools. Studio resolves ui:// app resources by
// scanning registered MCP servers and matching tool names.
export const mcpAppsAgent = new Agent({
  id: 'mcp-apps-agent',
  name: 'MCP Apps Agent',
  description: 'An agent that demonstrates MCP Apps — tools with interactive HTML UIs rendered in chat.',
  instructions: `You are a helpful assistant with access to interactive UI tools.
Your tools open interactive UIs that render directly in the chat. When you use a tool with an interactive UI:
- Briefly describe what the UI shows and what the user can do with it.
- Do NOT repeat or narrate the computed result — the UI displays it directly.
- Encourage the user to interact with the UI for further actions.

Available tools:
- calculatorWithUI: Opens an interactive calculator. Use when asked to do math.
- greetUserWithUI: Opens an interactive greeting app. Use when asked to greet someone.`,
  model: 'openai/gpt-5-mini',
  tools: {
    calculatorWithUI,
    greetUserWithUI,
  },
});
