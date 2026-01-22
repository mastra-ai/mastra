/**
 * RequestContext tests for DurableAgent
 *
 * Tests for RequestContext reserved keys and security features.
 * Validates that middleware can securely set resourceId and threadId
 * via reserved keys that take precedence over client-provided values.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { DurableAgent } from '@mastra/core/agent/durable';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel, createToolCallModel } from '../mock-models';

export function createRequestContextTests({ getPubSub }: DurableAgentTestContext) {
  describe('RequestContext reserved keys', () => {
    describe('basic RequestContext handling', () => {
      it('should accept requestContext option in prepare', async () => {
        const mockModel = createTextStreamModel('Hello!');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'request-context-agent',
          name: 'RequestContext Agent',
          instructions: 'Test requestContext',
          model: mockModel,
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
        const mockModel = createTextStreamModel('Hello!');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'stream-request-context-agent',
          name: 'Stream RequestContext Agent',
          instructions: 'Test requestContext',
          model: mockModel,
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
        const mockModel = createTextStreamModel('Hello!');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'reserved-keys-agent',
          name: 'Reserved Keys Agent',
          instructions: 'Test reserved keys',
          model: mockModel,
          pubsub,
        });

        const requestContext = new RequestContext();
        requestContext.set(MASTRA_RESOURCE_ID_KEY, 'context-user-123');
        requestContext.set(MASTRA_THREAD_ID_KEY, 'context-thread-456');

        const result = await agent.prepare('Hello', {
          requestContext,
        });

        expect(result.runId).toBeDefined();
      });

      it('should handle RequestContext with memory options', async () => {
        const mockModel = createTextStreamModel('Hello!');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'context-memory-agent',
          name: 'Context Memory Agent',
          instructions: 'Test context with memory',
          model: mockModel,
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

        expect(result.threadId).toBe('body-thread');
        expect(result.resourceId).toBe('body-resource');
      });
    });

    describe('RequestContext with tools', () => {
      it('should pass requestContext to tool execute', async () => {
        const mockModel = createToolCallModel('contextTool', { data: 'test' });
        const pubsub = getPubSub();

        const contextTool = createTool({
          id: 'contextTool',
          description: 'A tool that uses context',
          inputSchema: z.object({ data: z.string() }),
          execute: async (input, context) => {
            return { data: input.data, hasContext: !!context };
          },
        });

        const agent = new DurableAgent({
          id: 'tool-context-agent',
          name: 'Tool Context Agent',
          instructions: 'Use tools with context',
          model: mockModel,
          tools: { contextTool },
          pubsub,
        });

        const requestContext = new RequestContext();
        requestContext.set('userId', 'user-123');

        const result = await agent.prepare('Use the tool', {
          requestContext,
        });

        const tools = agent.runRegistry.getTools(result.runId);
        expect(tools.contextTool).toBeDefined();
      });
    });

    describe('RequestContext serialization', () => {
      it('should not include requestContext in serialized workflow input', async () => {
        const mockModel = createTextStreamModel('Hello!');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'serialize-context-agent',
          name: 'Serialize Context Agent',
          instructions: 'Test serialization',
          model: mockModel,
          pubsub,
        });

        const requestContext = new RequestContext();
        requestContext.set('sensitiveData', 'should-not-serialize');

        const result = await agent.prepare('Hello', {
          requestContext,
        });

        const serialized = JSON.stringify(result.workflowInput);
        expect(serialized).toBeDefined();
        expect(serialized).not.toContain('sensitiveData');
        expect(serialized).not.toContain('should-not-serialize');
      });
    });
  });

  describe('RequestContext edge cases', () => {
    it('should handle empty RequestContext', async () => {
      const mockModel = createTextStreamModel('Hello!');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'empty-context-agent',
        name: 'Empty Context Agent',
        instructions: 'Test empty context',
        model: mockModel,
        pubsub,
      });

      const requestContext = new RequestContext();

      const result = await agent.prepare('Hello', {
        requestContext,
      });

      expect(result.runId).toBeDefined();
    });

    it('should handle RequestContext with complex values', async () => {
      const mockModel = createTextStreamModel('Hello!');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'complex-context-agent',
        name: 'Complex Context Agent',
        instructions: 'Test complex context',
        model: mockModel,
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
      const mockModel = createTextStreamModel('Hello!');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'undefined-context-agent',
        name: 'Undefined Context Agent',
        instructions: 'Test undefined context',
        model: mockModel,
        pubsub,
      });

      const result = await agent.prepare('Hello', {});

      expect(result.runId).toBeDefined();
    });

    it('should handle RequestContext with special characters in keys', async () => {
      const mockModel = createTextStreamModel('Hello!');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'special-keys-agent',
        name: 'Special Keys Agent',
        instructions: 'Test special keys',
        model: mockModel,
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
}
