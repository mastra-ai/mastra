/**
 * Memory tests for DurableAgent
 */

import { describe, it, expect } from 'vitest';
import { DurableAgent } from '@mastra/core/agent/durable';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createMemoryTests({ getPubSub, eventPropagationDelay }: DurableAgentTestContext) {
  describe('memory integration', () => {
    it('should track threadId and resourceId in stream result', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'memory-test-agent',
        name: 'Memory Test Agent',
        instructions: 'Test',
        model: mockModel,
        pubsub,
      });

      const { threadId, resourceId, cleanup } = await agent.stream('Test', {
        memory: {
          thread: 'thread-123',
          resource: 'user-456',
        },
      });

      expect(threadId).toBe('thread-123');
      expect(resourceId).toBe('user-456');

      cleanup();
    });

    it('should store memory info in extended registry', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'registry-memory-agent',
        name: 'Registry Memory Agent',
        instructions: 'Test',
        model: mockModel,
        pubsub,
      });

      const { runId, cleanup } = await agent.stream('Test', {
        memory: {
          thread: 'my-thread',
          resource: 'my-user',
        },
      });

      const memoryInfo = agent.runRegistry.getMemoryInfo(runId);
      expect(memoryInfo).toEqual({
        threadId: 'my-thread',
        resourceId: 'my-user',
      });

      cleanup();
    });

    it('should handle streaming without memory options', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'no-memory-agent',
        name: 'No Memory Agent',
        instructions: 'Test',
        model: mockModel,
        pubsub,
      });

      const { threadId, resourceId, cleanup } = await agent.stream('Test');

      expect(threadId).toBeUndefined();
      expect(resourceId).toBeUndefined();

      cleanup();
    });

    it('should handle thread object with id', async () => {
      const mockModel = createTextStreamModel('Hello');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'thread-object-agent',
        name: 'Thread Object Agent',
        instructions: 'Test',
        model: mockModel,
        pubsub,
      });

      const { threadId, cleanup } = await agent.stream('Test', {
        memory: {
          thread: { id: 'thread-from-object' },
          resource: 'user-123',
        },
      });

      expect(threadId).toBe('thread-from-object');

      cleanup();
    });
  });
}
