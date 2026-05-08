/**
 * Dynamic memory configuration tests for DurableAgent
 *
 * Tests that memory options are properly propagated through
 * prepare() and stream() calls.
 */

import { describe, it, expect } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createDynamicMemoryTests(context: DurableAgentTestContext) {
  const { createAgent } = context;

  describe('dynamic memory configuration', () => {
    it('should propagate memory config via prepare', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'dynamic-memory-agent',
        instructions: 'Test dynamic memory',
        model: mockModel,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: 'thread-123',
          resource: 'user-456',
          options: { lastMessages: 10 },
        },
      });

      expect(result.workflowInput.state.threadId).toBe('thread-123');
      expect(result.workflowInput.state.resourceId).toBe('user-456');
      expect(result.workflowInput.state.memoryConfig).toBeDefined();
      expect(result.workflowInput.state.memoryConfig.lastMessages).toBe(10);
    });

    it('should handle thread as object with id', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'thread-obj-agent',
        instructions: 'Test thread object',
        model: mockModel,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: { id: 'thread-obj-123' },
          resource: 'user-789',
        },
      });

      expect(result.workflowInput.state.threadId).toBe('thread-obj-123');
      expect(result.workflowInput.state.resourceId).toBe('user-789');
    });

    it('should handle string thread format', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'thread-str-agent',
        instructions: 'Test string thread',
        model: mockModel,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: 'simple-thread-id',
        },
      });

      expect(result.workflowInput.state.threadId).toBe('simple-thread-id');
    });

    it('should return threadId and resourceId from stream', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'stream-memory-agent',
        instructions: 'Test stream with memory',
        model: mockModel,
      });

      const { threadId, resourceId, cleanup } = await agent.stream('Hello', {
        memory: {
          thread: 'stream-thread-123',
          resource: 'stream-user-456',
        },
      });

      expect(threadId).toBe('stream-thread-123');
      expect(resourceId).toBe('stream-user-456');

      cleanup();
    });

    it('should serialize readOnly flag in memory config', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'readonly-memory-agent',
        instructions: 'Test readOnly',
        model: mockModel,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: 'thread-readonly',
          resource: 'user-readonly',
          options: { readOnly: true },
        },
      });

      expect(result.workflowInput.state.memoryConfig).toBeDefined();
      expect(result.workflowInput.state.memoryConfig.readOnly).toBe(true);
    });
  });
}
