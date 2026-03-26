/**
 * Tests that a rate-limited OM model does not block the main agent response.
 *
 * When the observational memory model fails (e.g. rate limit from the provider),
 * the agent should continue normally without observations rather than aborting
 * the entire response.
 */

import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../..';

// =============================================================================
// Mock Models
// =============================================================================

type StreamPart =
  | { type: 'stream-start'; warnings: unknown[] }
  | { type: 'response-metadata'; id: string; modelId: string; timestamp: Date }
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id?: string; delta: string }
  | { type: 'text-end'; id: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: string }
  | {
      type: 'finish';
      finishReason: 'stop' | 'tool-calls';
      usage: { inputTokens: number; outputTokens: number; totalTokens: number };
    };

/** Main agent model that works fine — uses tool call first to generate multi-step interaction */
function createWorkingAgentModel(responseText: string) {
  let callCount = 0;

  return {
    specificationVersion: 'v2' as const,
    provider: 'mock-main',
    modelId: 'mock-main-model',
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},

    async doGenerate() {
      const firstCall = callCount === 0;
      callCount++;

      if (firstCall) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: `call-${Date.now()}`,
              toolName: 'test',
              input: JSON.stringify({ action: 'trigger' }),
            },
          ],
          warnings: [],
        };
      }

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [{ type: 'text' as const, text: responseText }],
        warnings: [],
      };
    },

    async doStream() {
      const firstCall = callCount === 0;
      callCount++;

      const parts: StreamPart[] = firstCall
        ? [
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-main-model', timestamp: new Date() },
            {
              type: 'tool-call',
              toolCallId: `call-${Date.now()}`,
              toolName: 'test',
              input: JSON.stringify({ action: 'trigger' }),
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
            },
          ]
        : [
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-main-model', timestamp: new Date() },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: responseText },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            },
          ];

      const stream = new ReadableStream<StreamPart>({
        async start(controller) {
          for (const part of parts) {
            controller.enqueue(part);
            await new Promise(resolve => setTimeout(resolve, 2));
          }
          controller.close();
        },
      });

      return {
        stream,
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  };
}

/**
 * OM observer model that throws a rate-limit error.
 * Simulates what happens when the provider (e.g. Anthropic) rate-limits
 * the OM model while the main agent model has been switched to a different provider.
 */
function createRateLimitedObserverModel() {
  return {
    specificationVersion: 'v2' as const,
    provider: 'mock-rate-limited',
    modelId: 'mock-rate-limited-observer',
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},

    async doGenerate() {
      throw new Error("This request would exceed your account's rate limit. Please try again later.");
    },

    async doStream() {
      throw new Error("This request would exceed your account's rate limit. Please try again later.");
    },
  };
}

/** OM reflector model (working) */
function createWorkingReflectorModel() {
  return {
    specificationVersion: 'v2' as const,
    provider: 'mock-reflector',
    modelId: 'mock-reflector-model',
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},

    async doGenerate() {
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [
          {
            type: 'text' as const,
            text: `<observations>\n## Condensed\n- User needs help\n</observations>`,
          },
        ],
        warnings: [],
      };
    },

    async doStream() {
      const text = `<observations>\n## Condensed\n- User needs help\n</observations>`;
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'ref-1',
            modelId: 'mock-reflector-model',
            timestamp: new Date(),
          });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
          controller.enqueue({ type: 'text-end', id: 'text-1' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          });
          controller.close();
        },
      });

      return {
        stream,
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  };
}

// =============================================================================
// Test helpers
// =============================================================================

const dummyTool = createTool({
  id: 'test',
  description: 'Trigger tool for OM testing',
  inputSchema: z.object({
    action: z.string().optional(),
  }),
  execute: async () => {
    return { success: true, message: 'Tool executed' };
  },
});

const longResponseText =
  'I understand your request completely. Let me provide you with a comprehensive and detailed response ' +
  'that covers all the important aspects of what you asked about. Here are my thoughts and recommendations ' +
  'based on the information you provided. I hope this detailed explanation helps clarify everything you need ' +
  'to know about the topic at hand. Please let me know if you have any follow-up questions or need additional ' +
  'clarification on any of these points.';

// =============================================================================
// Tests
// =============================================================================

describe('Rate-limited OM model should not block agent response', { timeout: 30_000 }, () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it('should return agent response even when OM model is rate-limited (generate)', async () => {
    const memory = new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          observation: {
            model: createRateLimitedObserverModel() as any,
            messageTokens: 20,
            bufferTokens: false,
          },
          reflection: {
            model: createWorkingReflectorModel() as any,
            observationTokens: 50000,
          },
        },
      },
    });

    const threadId = 'test-rate-limit-thread';
    const resource = 'test-resource';

    // Seed conversation history
    const seedAgent = new Agent({
      id: 'test-om-ratelimit-seed',
      name: 'Seed Agent',
      instructions: 'You are a helpful assistant. Always use the test tool first.',
      model: createWorkingAgentModel(longResponseText) as any,
      tools: { test: dummyTool },
      memory,
    });
    await seedAgent.generate('Hello, I need help with something important. ' + longResponseText, {
      memory: { thread: threadId, resource },
    });

    // Second call with fresh agent — OM model will fail, but agent should succeed
    const agent = new Agent({
      id: 'test-om-ratelimit',
      name: 'Test Agent',
      instructions: 'You are a helpful assistant. Always use the test tool first.',
      model: createWorkingAgentModel(longResponseText) as any,
      tools: { test: dummyTool },
      memory,
    });

    const result = await agent.generate('Can you tell me more? ' + longResponseText, {
      memory: { thread: threadId, resource },
    });

    // The agent should succeed — OM failure degrades gracefully
    // The response should contain text from the main model, NOT be killed by tripwire
    expect(result.text).toBeTruthy();
    expect(result.text).toContain('understand your request');
    // No tripwire — the agent continues normally
    expect(result.tripwire).toBeUndefined();
  });

  it('should stream agent response even when OM model is rate-limited', async () => {
    const memory = new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          observation: {
            model: createRateLimitedObserverModel() as any,
            messageTokens: 20,
            bufferTokens: false,
          },
          reflection: {
            model: createWorkingReflectorModel() as any,
            observationTokens: 50000,
          },
        },
      },
    });

    const threadId = 'test-rate-limit-stream';
    const resource = 'test-resource';

    // Seed conversation history
    const seedAgent = new Agent({
      id: 'test-om-ratelimit-seed-stream',
      name: 'Seed Agent',
      instructions: 'You are a helpful assistant. Always use the test tool first.',
      model: createWorkingAgentModel(longResponseText) as any,
      tools: { test: dummyTool },
      memory,
    });
    await seedAgent.generate('Hello, I need help with something important. ' + longResponseText, {
      memory: { thread: threadId, resource },
    });

    // Stream with fresh agent — OM fails, but stream should work
    const streamAgent = new Agent({
      id: 'test-om-ratelimit-stream',
      name: 'Test Agent Stream',
      instructions: 'You are a helpful assistant. Always use the test tool first.',
      model: createWorkingAgentModel(longResponseText) as any,
      tools: { test: dummyTool },
      memory,
    });

    const response = await streamAgent.stream('Tell me about TypeScript. ' + longResponseText, {
      memory: { thread: threadId, resource },
    });

    // Consume the text stream to get the full response
    let textContent = '';
    for await (const chunk of response.textStream) {
      textContent += chunk;
    }

    // Agent response streams normally — OM failure is gracefully degraded
    expect(textContent).toContain('understand your request');
  });
});
