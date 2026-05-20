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

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

// =============================================================================
// Mock Model: Multi-step execution via tool call
// =============================================================================

function createMockOmModel(
  responseText: string,
  toolName = 'test',
  toolInput: Record<string, unknown> = { action: 'trigger' },
) {
  let generateCallCount = 0;
  let streamCallCount = 0;

  return new MockLanguageModelV2({
    doGenerate: async () => {
      generateCallCount++;

      if (generateCallCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
          text: '',
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
        text: responseText,
        content: [{ type: 'text' as const, text: responseText }],
        warnings: [],
      };
    },
    doStream: async () => {
      streamCallCount++;

      if (streamCallCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start' as const, warnings: [] },
            {
              type: 'response-metadata' as const,
              id: 'mock-response',
              modelId: 'mock-model',
              timestamp: new Date(),
            },
            {
              type: 'tool-input-start' as const,
              id: 'call-1',
              toolName,
            },
            {
              type: 'tool-input-delta' as const,
              id: 'call-1',
              delta: JSON.stringify(toolInput),
            },
            {
              type: 'tool-input-end' as const,
              id: 'call-1',
            },
            {
              type: 'finish' as const,
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
            },
          ]),
        };
      }

      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          {
            type: 'response-metadata' as const,
            id: 'mock-response-2',
            modelId: 'mock-model',
            timestamp: new Date(),
          },
          { type: 'text-start' as const, id: 'text-1' },
          { type: 'text-delta' as const, id: 'text-1', delta: responseText },
          { type: 'text-end' as const, id: 'text-1' },
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          },
        ]),
      };
    },
  });
}

// =============================================================================
// Mock Observer/Reflector models
// =============================================================================

function createMockObserverModel() {
  const text = `<observations>
## January 28, 2026

### Thread: test-thread
- 🔴 User asked for help with a task
- Assistant provided a detailed response
</observations>
<current-task>Help the user with their request</current-task>
<suggested-response>I can help you with that.</suggested-response>`;

  return new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('Unexpected doGenerate call — OM should use the stream path');
    },
    doStream: async () => {
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'response-metadata',
            id: 'obs-1',
            modelId: 'mock-observer-model',
            timestamp: new Date(),
          },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: text },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

function createMockReflectorModel() {
  const text = `<observations>
## Condensed
- 🔴 User needs help with tasks
</observations>`;

  return new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('Unexpected doGenerate call — OM should use the stream path');
    },
    doStream: async () => {
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          {
            type: 'response-metadata',
            id: 'ref-1',
            modelId: 'mock-reflector-model',
            timestamp: new Date(),
          },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: text },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
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

  // TODO: processInputStep is not called by v5 execution engine for generate() — needs investigation.
  // On main, OM implements Processor directly; in our refactored architecture, ObservationalMemoryProcessor
  // is a separate class. The v5 execution engine's processor discovery may not find it.
  it('should insert a message boundary with a date matching the observed messages', async () => {
    // Create a model that supports multiple generate calls (alternating tool-call / text).
    // The shared createMockOmModel only fires a tool call on the very first call,
    // so a second agent.generate() would stay on step 0 and never trigger observation.
    let genCount = 0;
    const multiCallModel = new MockLanguageModelV2({
      doGenerate: async () => {
        genCount++;
        // Odd calls → tool call, even calls → text response
        if (genCount % 2 === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
            text: '',
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: `call-${genCount}`,
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
          text: longResponseText,
          content: [{ type: 'text' as const, text: longResponseText }],
          warnings: [],
        };
      },
    });

    const boundaryAgent = new Agent({
      id: 'test-om-boundary-agent',
      name: 'Test OM Boundary Agent',
      instructions: 'You are a helpful assistant. Always use the test tool first.',
      model: multiCallModel as any,
      tools: { test: omTriggerTool },
      memory,
    });

    const threadId = 'test-thread-boundary-date';
    const resourceId = 'test-resource';
    const memoryOpts = { thread: threadId, resource: resourceId };

    // First generate — creates initial observations (no boundary yet)
    const beforeFirstCall = new Date();
    await boundaryAgent.generate('Hello, I need help with something important.', { memory: memoryOpts });

    const memoryStore = await store.getStore('memory');
    const firstRecord = await memoryStore!.getObservationalMemory(threadId, resourceId);
    expect(firstRecord).toBeTruthy();
    expect(firstRecord!.activeObservations).toBeTruthy();
    // No boundary in first observation
    expect(firstRecord!.activeObservations).not.toMatch(/--- message boundary/);

    // Second generate — appends observations with a boundary
    await boundaryAgent.generate('Can you also help me with another task?', { memory: memoryOpts });
    const afterSecondCall = new Date();

    const secondRecord = await memoryStore!.getObservationalMemory(threadId, resourceId);
    expect(secondRecord).toBeTruthy();

    // Should now contain a message boundary delimiter with a date
    const boundaryMatch = secondRecord!.activeObservations!.match(/--- message boundary \(([^)]+)\) ---/);
    expect(boundaryMatch).toBeTruthy();

    const boundaryDate = new Date(boundaryMatch![1]!);
    expect(boundaryDate.getTime()).not.toBeNaN();

    // The boundary date should be the max createdAt of the messages observed in the second cycle.
    // Those messages were created between beforeFirstCall and afterSecondCall (wall-clock).
    // Since getMaxMessageTimestamp picks the latest createdAt from the observed messages,
    // and messages are saved at approximately wall-clock time, the boundary date should
    // fall within this window.
    expect(boundaryDate.getTime()).toBeGreaterThanOrEqual(beforeFirstCall.getTime());
    expect(boundaryDate.getTime()).toBeLessThanOrEqual(afterSecondCall.getTime());

    // The boundary date should also match the record's lastObservedAt
    // (which is set from getMaxMessageTimestamp + a small offset in some paths)
    expect(secondRecord!.lastObservedAt).toBeTruthy();
    const lastObserved = new Date(secondRecord!.lastObservedAt!);
    // lastObservedAt should be close to the boundary date (within a few seconds)
    expect(Math.abs(lastObserved.getTime() - boundaryDate.getTime())).toBeLessThan(5000);
  });

  // ===========================================================================
  // Message ordering regressions (agent-level)
  // ===========================================================================

  describe('Message ordering regressions', () => {
    async function getMessages(threadId: string) {
      const memoryStore = await store.getStore('memory');
      const result = await memoryStore!.listMessages({
        threadId,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        perPage: false,
      });
      return result.messages;
    }

    it('A — all messages persisted in correct order after multi-step generate', async () => {
      const threadId = 'test-thread-order-a';
      await agent.generate('Tell me something useful.', {
        memory: { thread: threadId, resource: 'test-resource' },
      });

      const messages = await getMessages(threadId);

      // Should have at least user + assistant messages
      expect(messages.length).toBeGreaterThanOrEqual(2);

      // User message should come before assistant
      const userIdx = messages.findIndex(m => m.role === 'user');
      const assistantIdx = messages.findIndex(m => m.role === 'assistant');
      expect(userIdx).toBeGreaterThanOrEqual(0);
      expect(assistantIdx).toBeGreaterThan(userIdx);

      // All IDs unique
      const ids = messages.map(m => m.id);
      expect(new Set(ids).size).toBe(ids.length);

      // createdAt monotonically non-decreasing
      for (let i = 1; i < messages.length; i++) {
        expect(new Date(messages[i]!.createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(messages[i - 1]!.createdAt).getTime(),
        );
      }
    });

    it('B — no duplicate messages with buffering enabled', async () => {
      const bufferStore = new InMemoryStore();
      const bufferMemory = new Memory({
        storage: bufferStore,
        options: {
          observationalMemory: {
            enabled: true,
            observation: {
              model: createMockObserverModel() as any,
              messageTokens: 20,
              bufferTokens: 15,
            },
            reflection: {
              model: createMockReflectorModel() as any,
              observationTokens: 50000,
            },
          },
        },
      });
      const bufferAgent = new Agent({
        id: 'test-om-buffer-agent',
        name: 'Buffer Agent',
        instructions: 'You are a helpful assistant. Always use the test tool first.',
        model: createMockOmModel(longResponseText) as any,
        tools: { test: omTriggerTool },
        memory: bufferMemory,
      });

      const threadId = 'test-thread-order-b';
      await bufferAgent.generate('Help me with this task.', {
        memory: { thread: threadId, resource: 'test-resource' },
      });

      const memoryStore = await bufferStore.getStore('memory');
      const result = await memoryStore!.listMessages({
        threadId,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        perPage: false,
      });
      const messages = result.messages;

      // No duplicate IDs
      const ids = messages.map(m => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('C — second turn loads full context and maintains order', async () => {
      const threadId = 'test-thread-order-c';
      const memOpts = { thread: threadId, resource: 'test-resource' };

      await agent.generate('First message', { memory: memOpts });
      await agent.generate('Second message', { memory: memOpts });

      const messages = await getMessages(threadId);

      // Both user messages should be present
      const userMsgs = messages.filter(m => m.role === 'user');
      expect(userMsgs.length).toBeGreaterThanOrEqual(2);

      // Chronological order
      for (let i = 1; i < messages.length; i++) {
        expect(new Date(messages[i]!.createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(messages[i - 1]!.createdAt).getTime(),
        );
      }

      // All IDs unique
      const ids = messages.map(m => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('D — message ordering survives sealing across turns', async () => {
      const bufferStore = new InMemoryStore();
      const bufferMemory = new Memory({
        storage: bufferStore,
        options: {
          observationalMemory: {
            enabled: true,
            observation: {
              model: createMockObserverModel() as any,
              messageTokens: 20,
              bufferTokens: 15,
            },
            reflection: {
              model: createMockReflectorModel() as any,
              observationTokens: 50000,
            },
          },
        },
      });

      let genCount = 0;
      const multiCallModel = new MockLanguageModelV2({
        doGenerate: async () => {
          genCount++;
          if (genCount % 2 === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
              text: '',
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: `call-${genCount}`,
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
            text: longResponseText,
            content: [{ type: 'text' as const, text: longResponseText }],
            warnings: [],
          };
        },
      });

      const bufferAgent = new Agent({
        id: 'test-om-seal-agent',
        name: 'Seal Agent',
        instructions: 'You are a helpful assistant. Always use the test tool first.',
        model: multiCallModel as any,
        tools: { test: omTriggerTool },
        memory: bufferMemory,
      });

      const threadId = 'test-thread-order-d';
      const memOpts = { thread: threadId, resource: 'test-resource' };

      await bufferAgent.generate('Turn 1 message', { memory: memOpts });
      await bufferAgent.generate('Turn 2 message', { memory: memOpts });

      const memoryStore = await bufferStore.getStore('memory');
      const result = await memoryStore!.listMessages({
        threadId,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        perPage: false,
      });
      const messages = result.messages;

      // Chronological order
      for (let i = 1; i < messages.length; i++) {
        expect(new Date(messages[i]!.createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(messages[i - 1]!.createdAt).getTime(),
        );
      }

      // No duplicate IDs
      const ids = messages.map(m => m.id);
      expect(new Set(ids).size).toBe(ids.length);

      // Both user messages should be present
      const userMsgs = messages.filter(m => m.role === 'user');
      expect(userMsgs.length).toBeGreaterThanOrEqual(2);
    });
  });
});
