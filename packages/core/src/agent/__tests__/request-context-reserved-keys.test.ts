/**
 * Tests for RequestContext reserved keys feature
 *
 * This feature allows middleware to securely set resourceId and threadId
 * via reserved keys in RequestContext, which take precedence over
 * client-provided values for security.
 *
 * Reserved keys:
 * - mastra__resourceId: Sets the resourceId for memory operations
 * - mastra__threadId: Sets the threadId for memory operations
 *
 * @see https://github.com/mastra-ai/mastra/issues/4296
 */
import { simulateReadableStream } from '@internal/ai-v7';
import { convertArrayToReadableStream, MockLanguageModelV4 } from '@internal/ai-v7/test';
import { beforeEach, describe, expect, it } from 'vitest';

import { MockMemory } from '../../memory/mock';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import { Agent } from '../index';

describe('RequestContext reserved keys for resourceId and threadId', () => {
  describe('v2 - generate', () => {
    let dummyModel: MockLanguageModelV4;

    beforeEach(() => {
      dummyModel = new MockLanguageModelV4({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: `Reserved keys test response`,
          content: [{ type: 'text', text: 'Reserved keys test response' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Reserved keys test response' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });
    });

    it('should use mastra__resourceId and mastra__threadId from RequestContext', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'test',
        model: dummyModel,
        memory: mockMemory,
      });

      // Create a RequestContext with reserved keys set (simulating middleware setting these)
      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'context-user-123');
      requestContext.set(MASTRA_THREAD_ID_KEY, 'context-thread-456');

      await agent.generate('hello', {
        requestContext,
        // Intentionally NOT passing resourceId/threadId in options
        // The agent should use the values from RequestContext
      });

      // Verify the thread was created with the resourceId and threadId from RequestContext
      const thread = await mockMemory.getThreadById({ threadId: 'context-thread-456' });
      expect(thread).toBeDefined();
      expect(thread?.id).toBe('context-thread-456');
      expect(thread?.resourceId).toBe('context-user-123');
    });

    it('RequestContext reserved keys should take precedence over body values for security', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'test',
        model: dummyModel,
        memory: mockMemory,
      });

      // Create a RequestContext with reserved keys set (simulating auth middleware)
      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'secure-user-from-middleware');
      requestContext.set(MASTRA_THREAD_ID_KEY, 'secure-thread-from-middleware');

      await agent.generate('hello', {
        requestContext,
        // An attacker might try to hijack another user's memory by passing different values
        resourceId: 'attacker-trying-to-hijack',
        threadId: 'attacker-thread',
      });

      // The middleware-set values should take precedence (for security)
      // The attacker's values should NOT be used
      const secureThread = await mockMemory.getThreadById({ threadId: 'secure-thread-from-middleware' });
      expect(secureThread).toBeDefined();
      expect(secureThread?.id).toBe('secure-thread-from-middleware');
      expect(secureThread?.resourceId).toBe('secure-user-from-middleware');

      // Verify the attacker's thread was NOT created
      const attackerThread = await mockMemory.getThreadById({ threadId: 'attacker-thread' });
      expect(attackerThread).toBeNull();
    });

    it('RequestContext reserved keys should take precedence over memory option values', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'test',
        model: dummyModel,
        memory: mockMemory,
      });

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'middleware-resource');
      requestContext.set(MASTRA_THREAD_ID_KEY, 'middleware-thread');

      await agent.generate('hello', {
        requestContext,
        // Using the new memory option format - these should be overridden by RequestContext
        memory: {
          resource: 'body-resource-should-be-ignored',
          thread: 'body-thread-should-be-ignored',
        },
      });

      // The middleware values should win
      const middlewareThread = await mockMemory.getThreadById({ threadId: 'middleware-thread' });
      expect(middlewareThread).toBeDefined();
      expect(middlewareThread?.id).toBe('middleware-thread');
      expect(middlewareThread?.resourceId).toBe('middleware-resource');

      // The body values should NOT be used
      const bodyThread = await mockMemory.getThreadById({ threadId: 'body-thread-should-be-ignored' });
      expect(bodyThread).toBeNull();
    });
  });

  describe('v2 - stream', () => {
    let dummyModel: MockLanguageModelV4;

    beforeEach(() => {
      dummyModel = new MockLanguageModelV4({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: `Reserved keys test response`,
          content: [{ type: 'text', text: 'Reserved keys test response' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Reserved keys test response' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });
    });

    it('should use mastra__resourceId and mastra__threadId from RequestContext', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'test',
        model: dummyModel,
        memory: mockMemory,
      });

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'stream-context-user');
      requestContext.set(MASTRA_THREAD_ID_KEY, 'stream-context-thread');

      const streamResult = await agent.stream('hello', {
        requestContext,
      });

      await streamResult.consumeStream();

      const thread = await mockMemory.getThreadById({ threadId: 'stream-context-thread' });
      expect(thread).toBeDefined();
      expect(thread?.id).toBe('stream-context-thread');
      expect(thread?.resourceId).toBe('stream-context-user');
    });

    it('RequestContext reserved keys should take precedence over memory option values', async () => {
      const mockMemory = new MockMemory();
      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'test',
        model: dummyModel,
        memory: mockMemory,
      });

      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'middleware-resource');
      requestContext.set(MASTRA_THREAD_ID_KEY, 'middleware-thread');

      const streamResult = await agent.stream('hello', {
        requestContext,
        // Using the new memory option format - these should be overridden by RequestContext
        memory: {
          resource: 'body-resource-should-be-ignored',
          thread: 'body-thread-should-be-ignored',
        },
      });

      await streamResult.consumeStream();

      // The middleware values should win
      const middlewareThread = await mockMemory.getThreadById({ threadId: 'middleware-thread' });
      expect(middlewareThread).toBeDefined();
      expect(middlewareThread?.id).toBe('middleware-thread');
      expect(middlewareThread?.resourceId).toBe('middleware-resource');

      // The body values should NOT be used
      const bodyThread = await mockMemory.getThreadById({ threadId: 'body-thread-should-be-ignored' });
      expect(bodyThread).toBeNull();
    });
  });
});
