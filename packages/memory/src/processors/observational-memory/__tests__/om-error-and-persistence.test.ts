/**
 * OM Error State & Persistence Tests
 *
 * Minimal integration tests for:
 * 1. Error state: When observer fails, agent should still complete and emit data-om-observation-failed
 * 2. Persistence: data-om-* parts should be saved to storage and retrievable after "reload"
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

function createMockOmModel(responseText: string) {
  let callCount = 0;

  return {
    specificationVersion: 'v2' as const,
    provider: 'mock',
    modelId: 'mock-om-model',
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
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-om-model', timestamp: new Date() },
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
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-om-model', timestamp: new Date() },
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

function createMockObserverModel() {
  return {
    specificationVersion: 'v2' as const,
    provider: 'mock-observer',
    modelId: 'mock-observer-model',
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},

    async doGenerate() {
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
        content: [
          {
            type: 'text' as const,
            text: `<observations>
## January 28, 2026

### Thread: test-thread
- 🔴 User asked for help with a task
-  Assistant provided a detailed response
</observations>
<current-task>Help the user with their request</current-task>
<suggested-response>I can help you with that.</suggested-response>`,
          },
        ],
        warnings: [],
      };
    },

    async doStream() {
      const text = `<observations>
## January 28, 2026

### Thread: test-thread
- 🔴 User asked for help with a task
-  Assistant provided a detailed response
</observations>
<current-task>Help the user with their request</current-task>
<suggested-response>I can help you with that.</suggested-response>`;

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'obs-1',
            modelId: 'mock-observer-model',
            timestamp: new Date(),
          });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
          controller.enqueue({ type: 'text-end', id: 'text-1' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
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

function createFailingObserverModel() {
  // Simulates an observer model that fails - throws from both doGenerate and doStream
  return {
    specificationVersion: 'v2' as const,
    provider: 'mock-failing-observer',
    modelId: 'mock-failing-observer-model',
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},

    async doGenerate() {
      throw new Error('Observer model failed: simulated API error');
    },

    async doStream() {
      throw new Error('Observer model failed: simulated API error');
    },
  };
}

function createMockReflectorModel() {
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
            text: `<observations>
## Condensed
- 🔴 User needs help with tasks
</observations>`,
          },
        ],
        warnings: [],
      };
    },

    async doStream() {
      const text = `<observations>
## Condensed
- 🔴 User needs help with tasks
</observations>`;

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
// Tool & Response Text
// =============================================================================

const omTriggerTool = createTool({
  id: 'test',
  description: 'Trigger tool for OM testing',
  inputSchema: z.object({
    action: z.string().optional(),
  }),
  execute: async () => {
    return { success: true, message: 'Tool executed' };
  },
});

const longResponseText = `I understand your request completely. Let me provide you with a comprehensive and detailed response that covers all the important aspects of what you asked about. Here are my thoughts and recommendations based on the information you provided. I hope this detailed explanation helps clarify everything you need to know about the topic at hand. Please let me know if you have any follow-up questions or need additional clarification on any of these points.`;

// =============================================================================
// Test 1: Error State - Observer fails, agent still completes
// =============================================================================

describe('OM Error State', { timeout: 30_000 }, () => {
  let store: InMemoryStore;
  let memory: Memory;
  let agent: Agent;

  beforeEach(() => {
    store = new InMemoryStore();

    memory = new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          observation: {
            model: createFailingObserverModel() as any,
            messageTokens: 20,
            bufferTokens: false, // Disable async buffering — test expects synchronous observation
          },
          reflection: {
            model: createMockReflectorModel() as any,
            observationTokens: 50000,
          },
        },
      },
    });

    agent = new Agent({
      id: 'test-fail-agent',
      name: 'Test Fail Agent',
      instructions: 'You are a helpful assistant. Always use the test tool first.',
      model: createMockOmModel(longResponseText) as any,
      tools: { test: omTriggerTool },
      memory,
    });
  });

  it('should complete agent execution even when observer fails', async () => {
    const result = await agent.generate('Hello, I need help.', {
      memory: {
        thread: 'test-error-thread',
        resource: 'test-resource',
      },
    });

    // Agent should still produce output despite observer failure
    expect(result.text).toBeTruthy();
    expect(result.text).toContain('I understand your request');
  });

  it('should emit data-om-observation-failed during streaming when observer fails', async () => {
    const allParts: any[] = [];

    const response = await agent.stream('Hello, I need help.', {
      memory: {
        thread: 'test-error-stream',
        resource: 'test-resource',
      },
    });

    const reader = response.fullStream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        allParts.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    // Agent should have produced text
    const hasText = allParts.some(p => p.type === 'text-delta');
    expect(hasText).toBe(true);

    // Should have emitted data-om-observation-failed
    const failedParts = allParts.filter(p => p.type === 'data-om-observation-failed');
    expect(failedParts.length).toBeGreaterThan(0);

    // The failed part should contain error info
    const failedPart = failedParts[0];
    expect(failedPart.data).toBeTruthy();
    expect(failedPart.data.error).toBeTruthy();
  });

  it('should persist data-om-observation-failed parts to storage', async () => {
    const threadId = 'test-error-persist';
    const resourceId = 'test-resource';

    // Stream a conversation that triggers observation (which will fail)
    const response = await agent.stream('Hello, I need help with something important.', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    // Consume the full stream
    const reader = response.fullStream.getReader();
    try {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }

    // Check storage - messages should contain data-om-observation-failed parts
    const memoryStore = await store.getStore('memory');
    const result = await memoryStore!.listMessages({ threadId });

    const assistantMessages = result.messages.filter((m: any) => m.role === 'assistant');
    expect(assistantMessages.length).toBeGreaterThan(0);

    // Check if any message has data-om-observation-failed parts
    const hasFailedParts = assistantMessages.some((msg: any) => {
      const parts = msg.content?.parts || [];
      return parts.some((p: any) => p.type === 'data-om-observation-failed');
    });

    expect(hasFailedParts).toBe(true);
  });
});

// =============================================================================
// Test 2: Persistence - data-om-* parts survive storage round-trip
// =============================================================================

describe('OM Persistence', () => {
  let store: InMemoryStore;
  let memory: Memory;
  let agent: Agent;

  beforeEach(() => {
    store = new InMemoryStore();

    memory = new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          observation: {
            model: createMockObserverModel() as any,
            messageTokens: 20,
            bufferTokens: false, // Disable async buffering — test expects synchronous observation
          },
          reflection: {
            model: createMockReflectorModel() as any,
            observationTokens: 50000,
          },
        },
      },
    });

    agent = new Agent({
      id: 'test-persist-agent',
      name: 'Test Persist Agent',
      instructions: 'You are a helpful assistant. Always use the test tool first.',
      model: createMockOmModel(longResponseText) as any,
      tools: { test: omTriggerTool },
      memory,
    });
  });

  it('should persist data-om-* parts to storage after streaming', async () => {
    const threadId = 'test-persist-thread';
    const resourceId = 'test-resource';

    // Stream a conversation that triggers observation
    const response = await agent.stream('Hello, I need help with something important.', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    // Consume the full stream
    const allParts: any[] = [];
    const reader = response.fullStream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        allParts.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    // Verify observation happened during streaming
    const omParts = allParts.filter(p => typeof p.type === 'string' && p.type.startsWith('data-om-'));
    expect(omParts.length).toBeGreaterThan(0);

    const hasStart = omParts.some(p => p.type === 'data-om-observation-start');
    const hasEnd = omParts.some(p => p.type === 'data-om-observation-end');
    expect(hasStart).toBe(true);
    expect(hasEnd).toBe(true);

    // Now check storage - messages should contain data-om-* parts
    const memoryStore = await store.getStore('memory');
    const result = await memoryStore!.listMessages({ threadId });

    // Find assistant messages (which should contain data-om-* parts)
    const assistantMessages = result.messages.filter((m: any) => m.role === 'assistant');
    expect(assistantMessages.length).toBeGreaterThan(0);

    // Check if any message has data-om-* parts in its content
    const hasOmParts = assistantMessages.some((msg: any) => {
      const parts = msg.content?.parts || [];
      return parts.some((p: any) => typeof p.type === 'string' && p.type.startsWith('data-om-'));
    });

    expect(hasOmParts).toBe(true);
  });

  it('should preserve data-om-* parts when loading messages from storage', async () => {
    const threadId = 'test-reload-thread';
    const resourceId = 'test-resource';

    // Stream a conversation that triggers observation
    const response = await agent.stream('Hello, I need help with something important.', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    // Consume the full stream
    const reader = response.fullStream.getReader();
    try {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }

    // Simulate "page reload" by loading messages from storage
    const memoryStore = await store.getStore('memory');
    const result = await memoryStore!.listMessages({ threadId });

    // Check that data-om-* parts survived the storage round-trip
    const hasOmParts = result.messages.some((msg: any) => {
      const parts = msg.content?.parts || [];
      return parts.some((p: any) => typeof p.type === 'string' && p.type.startsWith('data-om-'));
    });

    expect(hasOmParts).toBe(true);
  });
});
