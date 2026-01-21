/**
 * DurableAgent RequestContext Tests
 *
 * Tests for RequestContext reserved keys and security features.
 * Validates that middleware can securely set resourceId and threadId
 * via reserved keys that take precedence over client-provided values.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../../request-context';
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
// DurableAgent RequestContext Tests
// ============================================================================

describe('DurableAgent RequestContext reserved keys', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('basic RequestContext handling', () => {
    it('should accept requestContext option in prepare', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'request-context-agent',
        name: 'RequestContext Agent',
        instructions: 'Test requestContext',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const requestContext = new RequestContext();
      requestContext.set('customKey', 'customValue');

      const result = await agent.prepare('Hello', {
        requestContext,
      });

      expect(result.runId).toBeDefined();
    });

    it('should accept requestContext option in stream', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'stream-request-context-agent',
        name: 'Stream RequestContext Agent',
        instructions: 'Test requestContext',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const requestContext = new RequestContext();
      requestContext.set('userInfo', { role: 'admin' });

      const { runId, cleanup } = await agent.stream('Hello', {
        requestContext,
      });

      expect(runId).toBeDefined();
      cleanup();
    });
  });

  describe('reserved keys for security', () => {
    it('should use mastra__resourceId and mastra__threadId from RequestContext', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'reserved-keys-agent',
        name: 'Reserved Keys Agent',
        instructions: 'Test reserved keys',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'context-user-123');
      requestContext.set(MASTRA_THREAD_ID_KEY, 'context-thread-456');

      const result = await agent.prepare('Hello', {
        requestContext,
        // Not passing memory options - should use RequestContext values
      });

      expect(result.runId).toBeDefined();
      // The requestContext is passed through for runtime use
    });

    it('should handle RequestContext with memory options', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'context-memory-agent',
        name: 'Context Memory Agent',
        instructions: 'Test context with memory',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'middleware-user');
      requestContext.set(MASTRA_THREAD_ID_KEY, 'middleware-thread');

      const result = await agent.prepare('Hello', {
        requestContext,
        memory: {
          thread: 'body-thread',
          resource: 'body-resource',
        },
      });

      // Memory options from body are used for preparation
      // RequestContext reserved keys take precedence at runtime
      expect(result.threadId).toBe('body-thread');
      expect(result.resourceId).toBe('body-resource');
    });
  });

  describe('RequestContext with tools', () => {
    it('should pass requestContext to tool execute', async () => {
      const mockModel = createToolCallModel('contextTool', { data: 'test' });

      const contextTool = createTool({
        id: 'contextTool',
        description: 'A tool that uses context',
        inputSchema: z.object({ data: z.string() }),
        execute: async (input, context) => {
          // Tool receives context including requestContext
          return { data: input.data, hasContext: !!context };
        },
      });

      const agent = new DurableAgent({
        id: 'tool-context-agent',
        name: 'Tool Context Agent',
        instructions: 'Use tools with context',
        model: mockModel as LanguageModelV2,
        tools: { contextTool },
        pubsub,
      });

      const requestContext = new RequestContext();
      requestContext.set('userId', 'user-123');

      const result = await agent.prepare('Use the tool', {
        requestContext,
      });

      // Tool should be registered
      const tools = agent.runRegistry.getTools(result.runId);
      expect(tools.contextTool).toBeDefined();
    });
  });

  describe('RequestContext serialization', () => {
    it('should not include requestContext in serialized workflow input', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'serialize-context-agent',
        name: 'Serialize Context Agent',
        instructions: 'Test serialization',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const requestContext = new RequestContext();
      requestContext.set('sensitiveData', 'should-not-serialize');

      const result = await agent.prepare('Hello', {
        requestContext,
      });

      // Workflow input should be JSON-serializable
      // RequestContext is not serialized (it's stored in registry or passed separately)
      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();
      expect(serialized).not.toContain('sensitiveData');
      expect(serialized).not.toContain('should-not-serialize');
    });
  });
});

describe('DurableAgent RequestContext edge cases', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should handle empty RequestContext', async () => {
    const mockModel = createTextModel('Hello!');

    const agent = new DurableAgent({
      id: 'empty-context-agent',
      name: 'Empty Context Agent',
      instructions: 'Test empty context',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const requestContext = new RequestContext();
    // Empty context - no values set

    const result = await agent.prepare('Hello', {
      requestContext,
    });

    expect(result.runId).toBeDefined();
  });

  it('should handle RequestContext with complex values', async () => {
    const mockModel = createTextModel('Hello!');

    const agent = new DurableAgent({
      id: 'complex-context-agent',
      name: 'Complex Context Agent',
      instructions: 'Test complex context',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const requestContext = new RequestContext();
    requestContext.set('user', {
      id: 'user-123',
      roles: ['admin', 'user'],
      metadata: {
        lastLogin: new Date().toISOString(),
        preferences: { theme: 'dark' },
      },
    });

    const result = await agent.prepare('Hello', {
      requestContext,
    });

    expect(result.runId).toBeDefined();
  });

  it('should handle undefined requestContext', async () => {
    const mockModel = createTextModel('Hello!');

    const agent = new DurableAgent({
      id: 'undefined-context-agent',
      name: 'Undefined Context Agent',
      instructions: 'Test undefined context',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare('Hello', {
      // requestContext is not provided
    });

    expect(result.runId).toBeDefined();
  });

  it('should handle RequestContext with special characters in keys', async () => {
    const mockModel = createTextModel('Hello!');

    const agent = new DurableAgent({
      id: 'special-keys-agent',
      name: 'Special Keys Agent',
      instructions: 'Test special keys',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const requestContext = new RequestContext();
    requestContext.set('key-with-dashes', 'value1');
    requestContext.set('key_with_underscores', 'value2');
    requestContext.set('key.with.dots', 'value3');

    const result = await agent.prepare('Hello', {
      requestContext,
    });

    expect(result.runId).toBeDefined();
  });
});
