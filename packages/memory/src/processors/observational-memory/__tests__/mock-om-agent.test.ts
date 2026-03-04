/**
 * Mock OM Agent Integration Test
 *
 * Tests that a mock model correctly triggers multi-step execution
 * and OM observation. This validates the mock setup before using
 * it in Playground E2E tests.
 *
 * Flow:
 * 1. Step 0: Mock model returns tool-call → finishReason: 'tool-calls'
 * 2. Tool executes, results added to messages
 * 3. Step 1: Mock model returns text → finishReason: 'stop'
 * 4. OM processor sees stepNumber=1, checks threshold, triggers observation
 */

import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../..';

// =============================================================================
// Mock Model: Multi-step execution via tool call
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

function createMockOmModel(
  responseText: string,
  toolName = 'test',
  toolInput: Record<string, unknown> = { action: 'trigger' },
) {
  let callCount = 0;

  const isFirstCall = (): boolean => {
    return callCount === 0;
  };

  return {
    specificationVersion: 'v2' as const,
    provider: 'mock',
    modelId: 'mock-om-model',
    defaultObjectGenerationMode: undefined,
    supportsImageUrls: false,
    supportedUrls: {},

    async doGenerate() {
      const firstCall = isFirstCall();
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
              toolName,
              input: JSON.stringify(toolInput),
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
      const firstCall = isFirstCall();
      callCount++;

      const parts: StreamPart[] = firstCall
        ? [
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-om-model', timestamp: new Date() },
            {
              type: 'tool-call',
              toolCallId: `call-${Date.now()}`,
              toolName,
              input: JSON.stringify(toolInput),
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

// =============================================================================
// Mock Observer/Reflector models
// =============================================================================

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
// Tool
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

// =============================================================================
// Long response text to exceed the configured messageTokens threshold
// =============================================================================

const longResponseText = `I understand your request completely. Let me provide you with a comprehensive and detailed response that covers all the important aspects of what you asked about. Here are my thoughts and recommendations based on the information you provided. I hope this detailed explanation helps clarify everything you need to know about the topic at hand. Please let me know if you have any follow-up questions or need additional clarification on any of these points.`;

// =============================================================================
// Tests
// =============================================================================

describe('Mock OM Agent Integration', () => {
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
            messageTokens: 20, // Very low threshold to ensure observation triggers
            bufferTokens: false, // Disable async buffering — test expects synchronous observation
          },
          reflection: {
            model: createMockReflectorModel() as any,
            observationTokens: 50000, // High to prevent reflection
          },
        },
      },
    });

    agent = new Agent({
      id: 'test-om-agent',
      name: 'Test OM Agent',
      instructions: 'You are a helpful assistant. Always use the test tool first.',
      model: createMockOmModel(longResponseText) as any,
      tools: { test: omTriggerTool },
      memory,
    });
  });

  it('should execute multi-step: tool call on step 0, text on step 1', async () => {
    const result = await agent.generate('Hello, I need help with something important.', {
      memory: {
        thread: 'test-thread-multi',
        resource: 'test-resource',
      },
    });

    // Should have completed with text output
    expect(result.text).toBeTruthy();
    expect(result.text).toContain('I understand your request');

    // Should have executed the tool (2 steps)
    expect(result.steps.length).toBeGreaterThanOrEqual(2);

    // Step 0 should have tool call
    const step0 = result.steps[0];
    expect(step0?.toolCalls?.length).toBeGreaterThan(0);
    const toolCall = step0?.toolCalls?.[0] as any;
    expect(toolCall?.payload?.toolName).toBe('test');

    // Last step should have text
    const lastStep = result.steps[result.steps.length - 1];
    expect(lastStep?.text).toContain('I understand your request');
  });

  it('should trigger OM observation after multi-step execution', async () => {
    const result = await agent.generate('Hello, I need help with something important.', {
      memory: {
        thread: 'test-thread-om',
        resource: 'test-resource',
      },
    });

    // Should have completed
    expect(result.text).toBeTruthy();

    // Check if OM record was created with observations
    const memoryStore = await store.getStore('memory');
    const record = await memoryStore!.getObservationalMemory('test-thread-om', 'test-resource');

    // OM should have been initialized
    expect(record).toBeTruthy();

    // Observation MUST have been triggered (threshold is 50 tokens, response is ~100 tokens)
    expect(record!.activeObservations).toBeTruthy();
    expect(record!.activeObservations).toContain('User asked for help');
  });

  it('should work with streaming', async () => {
    const chunks: string[] = [];

    const response = await agent.stream('Tell me about the weather.', {
      memory: {
        thread: 'test-thread-stream',
        resource: 'test-resource',
      },
    });

    // Consume the stream
    for await (const chunk of response.textStream) {
      chunks.push(chunk);
    }

    const fullText = chunks.join('');
    expect(fullText).toContain('I understand your request');

    // Check OM record
    const memoryStore = await store.getStore('memory');
    const record = await memoryStore!.getObservationalMemory('test-thread-stream', 'test-resource');

    expect(record).toBeTruthy();
  });

  it('should emit data-om-* parts during streaming when observation triggers', async () => {
    const allParts: any[] = [];

    const response = await agent.stream('Hello, I need help with something important today.', {
      memory: {
        thread: 'test-thread-parts',
        resource: 'test-resource',
      },
    });

    // Consume the full stream to collect all parts
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

    // Check for tool-call step (multi-step execution)
    const hasToolCall = allParts.some(p => p.type === 'tool-call');
    expect(hasToolCall).toBe(true);

    // Check for tool-result (tool executed)
    const hasToolResult = allParts.some(p => p.type === 'tool-result');
    expect(hasToolResult).toBe(true);

    // Check for text output
    const hasText = allParts.some(p => p.type === 'text-delta');
    expect(hasText).toBe(true);

    // Check for data-om-* parts (observation markers)
    const omParts = allParts.filter(p => typeof p.type === 'string' && p.type.startsWith('data-om-'));

    // OM processor MUST emit progress, start, and end markers
    expect(omParts.length).toBeGreaterThan(0);

    const hasProgress = omParts.some(p => p.type === 'data-om-status');
    expect(hasProgress).toBe(true);

    // Observation MUST be triggered (threshold is 50 tokens, response is ~100 tokens)
    const hasStart = omParts.some(p => p.type === 'data-om-observation-start');
    const hasEnd = omParts.some(p => p.type === 'data-om-observation-end');
    expect(hasStart).toBe(true);
    expect(hasEnd).toBe(true);

    // Check OM record was created with actual observations
    const memoryStore = await store.getStore('memory');
    const record = await memoryStore!.getObservationalMemory('test-thread-parts', 'test-resource');
    expect(record).toBeTruthy();
    expect(record!.activeObservations).toBeTruthy();
    expect(record!.activeObservations).toContain('User asked for help');
  });

  it('should complete when primary agent with OM calls a sub-agent with OM', async () => {
    const subAgent = new Agent({
      id: 'sub-agent',
      name: 'Sub Agent',
      instructions: 'You are a research agent.',
      model: createMockOmModel(longResponseText) as any,
      tools: { test: omTriggerTool },
      memory: new Memory({
        storage: store,
        options: {
          observationalMemory: {
            enabled: true,
            observation: { model: createMockObserverModel() as any, messageTokens: 20, bufferTokens: false },
            reflection: { model: createMockReflectorModel() as any, observationTokens: 50000 },
          },
        },
      }),
    });

    const primaryAgent = new Agent({
      id: 'primary-agent',
      name: 'Primary Agent',
      instructions: 'Use your sub-agent.',
      model: createMockOmModel(longResponseText, 'agent-researcher', { prompt: 'Research this topic' }) as any,
      agents: { researcher: subAgent },
      memory: new Memory({
        storage: store,
        options: {
          observationalMemory: {
            enabled: true,
            observation: { model: createMockObserverModel() as any, messageTokens: 20, bufferTokens: false },
            reflection: { model: createMockReflectorModel() as any, observationTokens: 50000 },
          },
        },
      }),
    });

    const result = await primaryAgent.generate('Research something for me.', {
      memory: { thread: 'test-thread-sub', resource: 'test-resource' },
    });

    expect(result.text).toBeTruthy();
    expect(result.steps.length).toBeGreaterThanOrEqual(2);

    const memoryStore = await store.getStore('memory');

    // Primary agent's OM should have observed under the correct thread/resource
    const primaryRecord = await memoryStore!.getObservationalMemory('test-thread-sub', 'test-resource');
    expect(primaryRecord).toBeTruthy();
    expect(primaryRecord!.activeObservations).toContain('User asked for help');

    // Sub-agent should have its own thread with a separate resourceId
    const subAgentResourceId = 'test-resource-researcher';
    let subAgentThreads = await memoryStore!.listThreads({
      filter: { resourceId: subAgentResourceId },
    });

    for (let i = 0; i < 20 && subAgentThreads.threads.length === 0; i++) {
      await new Promise(resolve => setTimeout(resolve, 20));
      subAgentThreads = await memoryStore!.listThreads({
        filter: { resourceId: subAgentResourceId },
      });
    }

    expect(subAgentThreads.threads.length).toBe(1);

    // Sub-agent's OM record should have its own observations under its own identity
    const subThreadId = subAgentThreads.threads[0]!.id;
    const subRecord = await memoryStore!.getObservationalMemory(subThreadId, subAgentResourceId);
    expect(subRecord).toBeTruthy();
    expect(subRecord!.resourceId).toBe(subAgentResourceId);
    expect(subRecord!.activeObservations).toContain('User asked for help');
  });
});
