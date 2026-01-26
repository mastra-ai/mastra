/**
 * DurableAgent Memory Tests
 *
 * Tests for comprehensive memory features including readOnly, dynamic memory,
 * thread management, and memory config serialization in durable execution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { DurableAgent } from '../durable-agent';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a simple text model
 */
function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text', text }],
      warnings: [],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/**
 * Creates a model that returns a tool call
 */
function createToolCallModel(toolName: string, toolArgs: object) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: 'call-1',
          toolName,
          input: JSON.stringify(toolArgs),
          providerExecuted: false,
        },
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

// ============================================================================
// DurableAgent Memory Tests
// ============================================================================

describe('DurableAgent memory configuration', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('basic memory options', () => {
    it('should handle memory.thread as string', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'thread-string-agent',
        name: 'Thread String Agent',
        instructions: 'Test thread string',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: 'my-thread-id',
          resource: 'user-123',
        },
      });

      expect(result.threadId).toBe('my-thread-id');
      expect(result.resourceId).toBe('user-123');
      expect(result.workflowInput.state.threadId).toBe('my-thread-id');
      expect(result.workflowInput.state.resourceId).toBe('user-123');
    });

    it('should handle memory.thread as object with id', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'thread-object-agent',
        name: 'Thread Object Agent',
        instructions: 'Test thread object',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: { id: 'thread-from-object' },
          resource: 'user-456',
        },
      });

      expect(result.threadId).toBe('thread-from-object');
      expect(result.resourceId).toBe('user-456');
    });

    it('should handle missing memory options gracefully', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'no-memory-agent',
        name: 'No Memory Agent',
        instructions: 'Test without memory',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Hello');

      expect(result.threadId).toBeUndefined();
      expect(result.resourceId).toBeUndefined();
    });
  });

  describe('memory.options configuration', () => {
    it('should include readOnly option in workflow state', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'readonly-agent',
        name: 'ReadOnly Agent',
        instructions: 'Test readonly',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: 'thread-readonly',
          resource: 'user-readonly',
          options: {
            readOnly: true,
          },
        },
      });

      expect(result.workflowInput.state.memoryConfig?.readOnly).toBe(true);
    });

    it('should include lastMessages option in workflow state', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'lastmessages-agent',
        name: 'LastMessages Agent',
        instructions: 'Test lastMessages',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: 'thread-lastmsg',
          resource: 'user-lastmsg',
          options: {
            lastMessages: 10,
          },
        },
      });

      expect(result.workflowInput.state.memoryConfig?.lastMessages).toBe(10);
    });

    it('should include semanticRecall options in workflow state', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'semantic-agent',
        name: 'Semantic Agent',
        instructions: 'Test semantic recall',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: 'thread-semantic',
          resource: 'user-semantic',
          options: {
            semanticRecall: {
              topK: 5,
              messageRange: { before: 2, after: 2 },
            },
          },
        },
      });

      expect(result.workflowInput.state.memoryConfig?.semanticRecall).toBeDefined();
      expect(result.workflowInput.state.memoryConfig?.semanticRecall?.topK).toBe(5);
    });

    it('should combine multiple memory options', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'combined-memory-agent',
        name: 'Combined Memory Agent',
        instructions: 'Test combined options',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: 'thread-combined',
          resource: 'user-combined',
          options: {
            readOnly: false,
            lastMessages: 20,
            semanticRecall: {
              topK: 3,
            },
          },
        },
      });

      const memoryConfig = result.workflowInput.state.memoryConfig;
      expect(memoryConfig?.readOnly).toBe(false);
      expect(memoryConfig?.lastMessages).toBe(20);
      expect(memoryConfig?.semanticRecall?.topK).toBe(3);
    });
  });

  describe('memory serialization in workflow input', () => {
    it('should serialize memory config as JSON', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'serialization-agent',
        name: 'Serialization Agent',
        instructions: 'Test serialization',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: 'thread-serialize',
          resource: 'user-serialize',
          options: {
            lastMessages: 15,
            readOnly: true,
          },
        },
      });

      // Verify workflow input is JSON-serializable
      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();

      const parsed = JSON.parse(serialized);
      expect(parsed.state.threadId).toBe('thread-serialize');
      expect(parsed.state.resourceId).toBe('user-serialize');
      expect(parsed.state.memoryConfig.lastMessages).toBe(15);
      expect(parsed.state.memoryConfig.readOnly).toBe(true);
    });

    it('should handle undefined memory config values', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'undefined-config-agent',
        name: 'Undefined Config Agent',
        instructions: 'Test undefined values',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: 'thread-undefined',
          resource: 'user-undefined',
          // options is undefined
        },
      });

      // Should still be serializable
      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();

      const parsed = JSON.parse(serialized);
      expect(parsed.state.threadId).toBe('thread-undefined');
    });
  });

  describe('memory with streaming', () => {
    it('should pass memory options through stream()', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'stream-memory-agent',
        name: 'Stream Memory Agent',
        instructions: 'Test stream memory',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const { runId, threadId, resourceId, cleanup } = await agent.stream('Hello', {
        memory: {
          thread: 'stream-thread-123',
          resource: 'stream-user-456',
        },
      });

      expect(runId).toBeDefined();
      expect(threadId).toBe('stream-thread-123');
      expect(resourceId).toBe('stream-user-456');
      cleanup();
    });

    it('should handle memory options with readOnly in stream()', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'readonly-stream-agent',
        name: 'ReadOnly Stream Agent',
        instructions: 'Test readonly stream',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const { runId, cleanup } = await agent.stream('Hello', {
        memory: {
          thread: 'readonly-stream-thread',
          resource: 'readonly-stream-user',
          options: {
            readOnly: true,
          },
        },
      });

      expect(runId).toBeDefined();
      cleanup();
    });
  });

  describe('memory with tools', () => {
    it('should preserve memory context when using tools', async () => {
      const mockModel = createToolCallModel('searchTool', { query: 'test' });

      const searchTool = createTool({
        id: 'searchTool',
        description: 'Search for information',
        inputSchema: z.object({ query: z.string() }),
        execute: async () => ({ results: ['result1'] }),
      });

      const agent = new DurableAgent({
        id: 'tool-memory-agent',
        name: 'Tool Memory Agent',
        instructions: 'Search with memory',
        model: mockModel as LanguageModelV2,
        tools: { searchTool },
        pubsub,
      });

      const result = await agent.prepare('Search for test', {
        memory: {
          thread: 'tool-thread',
          resource: 'tool-user',
          options: {
            lastMessages: 5,
          },
        },
      });

      expect(result.threadId).toBe('tool-thread');
      expect(result.workflowInput.state.memoryConfig?.lastMessages).toBe(5);

      // Tools should be registered
      const tools = agent.runRegistry.getTools(result.runId);
      expect(tools.searchTool).toBeDefined();
    });

    it('should serialize memory config with requireToolApproval', async () => {
      const mockModel = createToolCallModel('approvalTool', { data: 'test' });

      const approvalTool = createTool({
        id: 'approvalTool',
        description: 'Tool requiring approval',
        inputSchema: z.object({ data: z.string() }),
        requireApproval: true,
        execute: async () => ({ approved: true }),
      });

      const agent = new DurableAgent({
        id: 'approval-memory-agent',
        name: 'Approval Memory Agent',
        instructions: 'Use approval tool with memory',
        model: mockModel as LanguageModelV2,
        tools: { approvalTool },
        pubsub,
      });

      const result = await agent.prepare('Use the approval tool', {
        memory: {
          thread: 'approval-thread',
          resource: 'approval-user',
        },
        requireToolApproval: true,
      });

      expect(result.workflowInput.state.threadId).toBe('approval-thread');
      expect(result.workflowInput.options.requireToolApproval).toBe(true);
    });
  });
});

describe('DurableAgent memory edge cases', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should handle empty thread ID string', async () => {
    const mockModel = createTextModel('Hello!');

    const agent = new DurableAgent({
      id: 'empty-thread-agent',
      name: 'Empty Thread Agent',
      instructions: 'Test empty thread',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Hello', {
      memory: {
        thread: '',
        resource: 'user-empty-thread',
      },
    });

    expect(result.threadId).toBe('');
    expect(result.resourceId).toBe('user-empty-thread');
  });

  it('should handle special characters in thread/resource IDs', async () => {
    const mockModel = createTextModel('Hello!');

    const agent = new DurableAgent({
      id: 'special-chars-agent',
      name: 'Special Chars Agent',
      instructions: 'Test special characters',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Hello', {
      memory: {
        thread: 'thread-with-special-chars_123-abc',
        resource: 'user@example.com',
      },
    });

    expect(result.threadId).toBe('thread-with-special-chars_123-abc');
    expect(result.resourceId).toBe('user@example.com');
  });

  it('should handle very long thread/resource IDs', async () => {
    const mockModel = createTextModel('Hello!');
    const longId = 'a'.repeat(1000);

    const agent = new DurableAgent({
      id: 'long-id-agent',
      name: 'Long ID Agent',
      instructions: 'Test long IDs',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Hello', {
      memory: {
        thread: `thread-${longId}`,
        resource: `user-${longId}`,
      },
    });

    expect(result.threadId).toBe(`thread-${longId}`);
    expect(result.resourceId).toBe(`user-${longId}`);

    // Should still serialize correctly
    const serialized = JSON.stringify(result.workflowInput);
    expect(serialized).toContain(longId);
  });

  it('should handle memory options with zero values', async () => {
    const mockModel = createTextModel('Hello!');

    const agent = new DurableAgent({
      id: 'zero-values-agent',
      name: 'Zero Values Agent',
      instructions: 'Test zero values',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Hello', {
      memory: {
        thread: 'thread-zero',
        resource: 'user-zero',
        options: {
          lastMessages: 0,
        },
      },
    });

    expect(result.workflowInput.state.memoryConfig?.lastMessages).toBe(0);
  });
});
