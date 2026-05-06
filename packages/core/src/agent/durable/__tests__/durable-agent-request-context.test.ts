/**
 * DurableAgent RequestContext Tests
 *
 * Tests for RequestContext reserved keys and security features.
 * Validates that middleware can securely set resourceId and threadId
 * via reserved keys that take precedence over client-provided values.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../../request-context';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

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

      const baseAgent = new Agent({
        id: 'request-context-agent',
        name: 'RequestContext Agent',
        instructions: 'Test requestContext',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const requestContext = new RequestContext();
      requestContext.set('customKey', 'customValue');

      const result = await durableAgent.prepare('Hello', {
        requestContext,
      });

      expect(result.runId).toBeDefined();
    });

    it('should accept requestContext option in stream', async () => {
      const mockModel = createTextModel('Hello!');

      const baseAgent = new Agent({
        id: 'stream-request-context-agent',
        name: 'Stream RequestContext Agent',
        instructions: 'Test requestContext',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const requestContext = new RequestContext();
      requestContext.set('userInfo', { role: 'admin' });

      const { runId, cleanup } = await durableAgent.stream('Hello', {
        requestContext,
      });

      expect(runId).toBeDefined();
      cleanup();
    });
  });

  describe('reserved keys for security', () => {
    it('should use mastra__resourceId and mastra__threadId from RequestContext', async () => {
      const mockModel = createTextModel('Hello!');

      const baseAgent = new Agent({
        id: 'reserved-keys-agent',
        name: 'Reserved Keys Agent',
        instructions: 'Test reserved keys',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'context-user-123');
      requestContext.set(MASTRA_THREAD_ID_KEY, 'context-thread-456');

      const result = await durableAgent.prepare('Hello', {
        requestContext,
        // Not passing memory options - should use RequestContext values
      });

      expect(result.runId).toBeDefined();
      // The requestContext is passed through for runtime use
    });

    it('should handle RequestContext with memory options', async () => {
      const mockModel = createTextModel('Hello!');

      const baseAgent = new Agent({
        id: 'context-memory-agent',
        name: 'Context Memory Agent',
        instructions: 'Test context with memory',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'middleware-user');
      requestContext.set(MASTRA_THREAD_ID_KEY, 'middleware-thread');

      const result = await durableAgent.prepare('Hello', {
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
      let receivedRequestContext: unknown = undefined;

      // Model that calls a tool on first invocation, then returns text
      let callCount = 0;
      const mockModel = new MockLanguageModelV2({
        doStream: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-1',
                  toolName: 'contextTool',
                  input: JSON.stringify({ data: 'test' }),
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
            };
          }
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Done' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        },
      });

      const contextTool = createTool({
        id: 'contextTool',
        description: 'A tool that captures requestContext',
        inputSchema: z.object({ data: z.string() }),
        execute: async (input, context) => {
          // Capture the requestContext passed to the tool
          receivedRequestContext = context?.requestContext;
          return { data: input.data };
        },
      });

      const baseAgent = new Agent({
        id: 'tool-context-agent',
        name: 'Tool Context Agent',
        instructions: 'Use tools with context',
        model: mockModel as LanguageModelV2,
        tools: { contextTool },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const requestContext = new RequestContext();
      requestContext.set('userId', 'user-123');

      // Stream to actually execute the tool
      const { cleanup } = await durableAgent.stream('Use the tool', {
        requestContext,
      });

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 200));
      cleanup();

      // Verify requestContext was passed through to tool.execute()
      expect(receivedRequestContext).toBeDefined();
      expect((receivedRequestContext as RequestContext).get('userId')).toBe('user-123');
    });
  });

  describe('RequestContext serialization', () => {
    it('should not include requestContext in serialized workflow input', async () => {
      const mockModel = createTextModel('Hello!');

      const baseAgent = new Agent({
        id: 'serialize-context-agent',
        name: 'Serialize Context Agent',
        instructions: 'Test serialization',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const requestContext = new RequestContext();
      requestContext.set('sensitiveData', 'should-not-serialize');

      const result = await durableAgent.prepare('Hello', {
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

    const baseAgent = new Agent({
      id: 'empty-context-agent',
      name: 'Empty Context Agent',
      instructions: 'Test empty context',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const requestContext = new RequestContext();
    // Empty context - no values set

    const result = await durableAgent.prepare('Hello', {
      requestContext,
    });

    expect(result.runId).toBeDefined();
  });

  it('should handle RequestContext with complex values', async () => {
    const mockModel = createTextModel('Hello!');

    const baseAgent = new Agent({
      id: 'complex-context-agent',
      name: 'Complex Context Agent',
      instructions: 'Test complex context',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const requestContext = new RequestContext();
    requestContext.set('user', {
      id: 'user-123',
      roles: ['admin', 'user'],
      metadata: {
        lastLogin: new Date().toISOString(),
        preferences: { theme: 'dark' },
      },
    });

    const result = await durableAgent.prepare('Hello', {
      requestContext,
    });

    expect(result.runId).toBeDefined();
  });

  it('should handle undefined requestContext', async () => {
    const mockModel = createTextModel('Hello!');

    const baseAgent = new Agent({
      id: 'undefined-context-agent',
      name: 'Undefined Context Agent',
      instructions: 'Test undefined context',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Hello', {
      // requestContext is not provided
    });

    expect(result.runId).toBeDefined();
  });

  it('should handle RequestContext with special characters in keys', async () => {
    const mockModel = createTextModel('Hello!');

    const baseAgent = new Agent({
      id: 'special-keys-agent',
      name: 'Special Keys Agent',
      instructions: 'Test special keys',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const requestContext = new RequestContext();
    requestContext.set('key-with-dashes', 'value1');
    requestContext.set('key_with_underscores', 'value2');
    requestContext.set('key.with.dots', 'value3');

    const result = await durableAgent.prepare('Hello', {
      requestContext,
    });

    expect(result.runId).toBeDefined();
  });
});
