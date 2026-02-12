import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

import { weatherInfo } from '../tools';
import * as aiTest from 'ai/test';
import { fixtures } from '../../../fixtures';
import { Fixtures } from '../../../types';
import { lessComplexWorkflow } from '../workflows/complex-workflow';
import { simpleMcpTool } from '../tools';
import { storage } from '../storage';
import { createMockOmModel } from '../mock-om-model';
import { createTool } from '@mastra/core/tools';

const memory = new Memory({
  // ...
  storage,

  options: {
    generateTitle: true,
  },
});

// Mock model for Observer/Reflector in E2E tests
// Returns a simple observation/reflection response
const mockObserverModel = new aiTest.MockLanguageModelV2({
  provider: 'mock',
  modelId: 'mock-observer',
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop' as const,
    usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
    content: [
      {
        type: 'text' as const,
        text: `<observations>
## January 27, 2026

### Thread: test-thread
- 🔴 User asked for help with a task
-  User mentioned they need assistance
</observations>
<current-task>Help the user with their request</current-task>
<suggested-response>I can help you with that. What specifically do you need?</suggested-response>`,
      },
    ],
    warnings: [],
  }),
});

const mockReflectorModel = new aiTest.MockLanguageModelV2({
  provider: 'mock',
  modelId: 'mock-reflector',
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop' as const,
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    content: [
      {
        type: 'text' as const,
        text: `<observations>
## January 27, 2026

### Condensed observations
- 🔴 User needs help with tasks
</observations>`,
      },
    ],
    warnings: [],
  }),
});

// Memory with Observational Memory enabled for testing OM UI
// Using very low thresholds so observations trigger quickly in E2E tests
// Using mock models for observation/reflection to avoid real API calls
const omMemory = new Memory({
  storage,
  options: {
    generateTitle: true,
    observationalMemory: {
      observation: {
        model: mockObserverModel,
        messageTokens: 20, // Very low threshold for E2E tests
      },
      reflection: {
        model: mockReflectorModel,
        observationTokens: 50, // Low enough that mock observer output (~100 tokens) triggers reflection
      },
    },
  },
});

// Memory with shared token budget enabled
// Using very low thresholds so observations trigger quickly in E2E tests
// Using mock models for observation/reflection to avoid real API calls
const omAdaptiveMemory = new Memory({
  storage,
  options: {
    generateTitle: true,
    observationalMemory: {
      shareTokenBudget: true,
      observation: {
        model: mockObserverModel,
        messageTokens: 20, // Very low threshold for E2E tests
        bufferTokens: false, // Required: shareTokenBudget is not yet compatible with async buffering
      },
      reflection: {
        model: mockReflectorModel,
        observationTokens: 200, // Low threshold for E2E tests
      },
    },
  },
});

import { z } from 'zod';

/**
 * Tool that the mock OM model calls to trigger multi-step execution.
 * The OM processor only triggers observations when stepNumber > 0,
 * so we need the model to call a tool on step 0, then return text on step 1.
 */
const omTriggerTool = createTool({
  id: 'test',
  description: 'Test tool',
  inputSchema: z.object({
    action: z.string().optional(),
  }),
  execute: async () => {
    return { success: true, message: 'Tool executed successfully' };
  },
});

let count = 0;

// Helper function to create a delayed readable stream
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createDelayedStream(chunks: Array<any>, delayMs: number = 10) {
  return new ReadableStream({
    async start(controller) {
      for (let i = 0; i < chunks.length; i++) {
        controller.enqueue(chunks[i]);
        // Add delay only for text-delta chunks to show progressive text streaming
        // Skip delay for other chunk types to speed up tool/workflow execution
        if (delayMs > 0 && chunks[i]?.type === 'text-delta' && i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      controller.close();
    },
  });
}

export const subAgent = new Agent({
  id: 'sub-agent',
  name: 'Sub Agent',
  instructions: `You are a helpful sub agent that provides accurate weather information.`,
  model: 'google/gemini-2.5-pro',
});

export const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent',
  instructions: `
      You are a helpful weather assistant that provides accurate weather information.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If the location name isn't in English, please translate it
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative
`,
  model: ({ requestContext }) => {
    const fixture = requestContext.get('fixture') as Fixtures;

    console.log({ fixture });
    const fixtureData = fixtures[fixture];

    // Default response for API tests that don't set a fixture
    const defaultResponse = {
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text' as const, text: 'Mock response' }],
      warnings: [],
    };

    return new aiTest.MockLanguageModelV2({
      doGenerate: async () => {
        if (!fixtureData || fixtureData.length === 0) {
          return defaultResponse;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chunk = fixtureData[count] as Array<any>;

        count++;
        if (count >= fixtureData.length) {
          count = 0;
        }

        // Extract text from fixture chunks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textChunks = chunk.filter((item: any) => item.type === 'text-delta').map((item: any) => item.delta);
        const text = textChunks.join('');

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'text',
              text,
            },
          ],
          warnings: [],
        };
      },
      doStream: async () => {
        if (!fixtureData || fixtureData.length === 0) {
          return {
            stream: createDelayedStream([{ type: 'text-delta', delta: 'Mock response' }, { type: 'finish' }], 0),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chunk = fixtureData[count] as Array<any>;

        count++;
        if (count >= fixtureData.length) {
          count = 0;
        }

        return {
          stream: createDelayedStream(chunk, 20),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });
  },
  tools: { weatherInfo, simpleMcpTool },
  agents: { subAgent },
  workflows: { lessComplexWorkflow },
  memory,
});

/**
 * Agent with Observational Memory enabled
 * Used for testing OM UI components (sidebar, chat markers, progress bars)
 *
 * Uses a custom mock model that triggers multi-step execution via tool calls.
 * The OM processor only triggers observations when stepNumber > 0, so:
 * - Step 0: Model calls test tool with finishReason: 'tool-calls'
 * - Step 1: Model returns text with finishReason: 'stop'
 * - OM processor sees stepNumber=1, checks threshold, triggers observation
 */
// Long response text to ensure we exceed the 50-token observation threshold.
// The OM processor counts tokens from all unobserved messages in the thread.
// By step 1 (after tool call), the thread contains: system prompt + user message +
// tool call + tool result + this response text. We need the total to exceed 50 tokens.
const omResponseText = `I understand your request completely. Let me provide you with a comprehensive and detailed response that covers all the important aspects of what you asked about. Here are my thoughts and recommendations based on the information you provided. I hope this detailed explanation helps clarify everything you need to know about the topic at hand. Please let me know if you have any follow-up questions or need additional clarification on any of these points.`;

export const omAgent = new Agent({
  id: 'om-agent',
  name: 'OM Agent',
  instructions: `You are a helpful assistant with observational memory enabled.
Your memory system automatically observes and compresses conversation history.
Always use the test tool first before responding to the user.`,
  model: createMockOmModel({
    provider: 'mock',
    modelId: 'gpt-4o-mini',
    toolName: 'test',
    toolInput: { action: 'trigger-observation' },
    responseText: omResponseText,
    delayMs: 10,
  }),
  tools: { test: omTriggerTool },
  memory: omMemory,
});

/**
 * Agent with Adaptive Threshold enabled
 * Used for testing adaptive threshold UI behavior
 *
 * Uses the same multi-step mock model approach as omAgent.
 */
export const omAdaptiveAgent = new Agent({
  id: 'om-adaptive-agent',
  name: 'OM Adaptive Agent',
  instructions: `You are a helpful assistant with adaptive observational memory.
Your memory thresholds adjust dynamically based on current observation size.
Always use the test tool first before responding to the user.`,
  model: createMockOmModel({
    provider: 'mock',
    modelId: 'gpt-4o-mini',
    toolName: 'test',
    toolInput: { action: 'trigger-observation' },
    responseText: omResponseText,
    delayMs: 10,
  }),
  tools: { test: omTriggerTool },
  memory: omAdaptiveMemory,
});
