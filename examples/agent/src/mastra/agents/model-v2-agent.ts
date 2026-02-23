import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai-v5';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { lessComplexWorkflow, myWorkflow } from '../workflows';
import { Memory } from '@mastra/memory';
import { ModerationProcessor } from '@mastra/core/processors';
import { logDataMiddleware } from '../../model-middleware';
import { wrapLanguageModel } from 'ai-v5';
import { cookingTool } from '../tools';
import {
  advancedModerationWorkflow,
  branchingModerationWorkflow,
  contentModerationWorkflow,
} from '../workflows/content-moderation';
import { stepLoggerProcessor, responseQualityProcessor } from '../processors';
import { findUserWorkflow } from '../workflows/other';
import { createScorer } from '@mastra/core/evals';

import { Workspace, LocalFilesystem } from '@mastra/core/workspace';

const workspace = new Workspace({
  filesystem: new LocalFilesystem({
    basePath: './workspace',
  }),
});

export const weatherInfo = createTool({
  id: 'weather-info',
  description: 'Fetches the current weather information for a given city',
  suspendSchema: z.object({
    message: z.string(),
  }),
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

// const testAPICallError = new APICallError({
//   message: 'Test API error',
//   url: 'https://test.api.com',
//   requestBodyValues: { test: 'test' },
//   statusCode: 401,
//   isRetryable: false,
//   responseBody: 'Test API error response',
// });

export const errorAgent = new Agent({
  id: 'error-agent',
  name: 'Error Agent',
  instructions: 'You are an error agent that always errors',
  model: 'openai/gpt-4o-mini',
});

export const moderationProcessor = new ModerationProcessor({
  model: openai('gpt-4.1-nano'),
  categories: ['hate', 'harassment', 'violence'],
  threshold: 0.7,
  strategy: 'block',
  instructions: 'Detect and flag inappropriate content in user messages',
});

export const chefModelV2Agent = new Agent({
  workspace,
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
    model: openai('gpt-4o-mini'),
    middleware: logDataMiddleware,
  }),
  tools: {
    weatherInfo,
    cookingTool,
  },
  workflows: {
    myWorkflow,
    lessComplexWorkflow,
    findUserWorkflow,
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
  inputProcessors: [moderationProcessor],
  defaultOptions: {
    autoResumeSuspendedTools: true,
  },
});

const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent',
  instructions: `Your goal is to execute the recipe-maker workflow with the given ingredient`,
  description: `An agent that can help you get a recipe for a given ingredient`,
  model: 'openai/gpt-4o-mini',
  tools: {
    weatherInfo,
  },
  workflows: {
    myWorkflow,
  },
});

let count = 1;

export const networkAgent = new Agent({
  id: 'network-agent',
  name: 'Chef Network',
  description:
    'A chef agent that can help you cook great meals with whatever ingredients you have available based on your location and current weather.',
  instructions: `You are a the manager of several agent, tools, and workflows. Use the best primitives based on what the user wants to accomplish your task.`,
  model: 'openai/gpt-4o-mini',
  agents: {
    weatherAgent,
  },
  workflows: {
    myWorkflow,
    findUserWorkflow,
  },
  // tools: {
  //   weatherInfo,
  // },
  memory,
  defaultNetworkOptions: {
    autoResumeSuspendedTools: true,
    completion: {
      scorers: [
        createScorer({
          id: 'scorer12',
          name: 'My Scorer 2',
          description: 'Scorer 2',
        }).generateScore(() => {
          return 1;
        }),
        createScorer({
          id: 'scorer15',
          name: 'My Scorer 5',
          description: 'Scorer 5',
        }).generateScore(() => {
          count++;
          return count > 2 ? 1 : 0.7;
        }),
      ],
      strategy: 'all',
    },
  },
});

// =============================================================================
// Agents with Processor Workflows
// These demonstrate using processor workflows for content moderation
// =============================================================================

/**
 * Agent with Advanced Moderation Workflow
 *
 * Uses the advanced moderation workflow that includes:
 * - Length validation
 * - Parallel PII, toxicity, and spam checks
 * - Language detection
 */
export const agentWithAdvancedModeration = new Agent({
  id: 'agent-with-advanced-moderation',
  name: 'Agent with Advanced Moderation',
  description: 'A helpful assistant with advanced content moderation using parallel processor checks.',
  instructions: `You are a helpful assistant. Always provide detailed, thoughtful responses.`,
  model: 'openai/gpt-4o-mini',
  inputProcessors: [advancedModerationWorkflow],
  outputProcessors: [responseQualityProcessor, stepLoggerProcessor],
  maxProcessorRetries: 2,
});

/**
 * Agent with Branching Moderation Workflow
 *
 * Uses conditional branching to apply different processors based on content.
 */
export const agentWithBranchingModeration = new Agent({
  id: 'agent-with-branching-moderation',
  name: 'Agent with Branching Moderation',
  description: 'A helpful assistant with smart content moderation that branches based on message content.',
  instructions: `You are a helpful assistant.`,
  model: 'openai/gpt-4o-mini',
  inputProcessors: [branchingModerationWorkflow],
  outputProcessors: [stepLoggerProcessor],
  maxProcessorRetries: 2,
});

/**
 * Agent with Sequential Moderation Workflow
 *
 * Uses a simple sequential workflow for content moderation.
 */
export const agentWithSequentialModeration = new Agent({
  id: 'agent-with-sequential-moderation',
  name: 'Agent with Sequential Moderation',
  description: 'A helpful assistant with sequential content moderation checks.',
  instructions: `You are a helpful assistant.`,
  model: 'openai/gpt-4o-mini',
  inputProcessors: [contentModerationWorkflow],
  outputProcessors: [responseQualityProcessor],
  maxProcessorRetries: 2,
});
