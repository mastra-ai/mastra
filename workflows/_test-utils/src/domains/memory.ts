/**
 * Memory tests for DurableAgent
 */

import { describe, it, expect } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createMemoryTests({ createAgent, eventPropagationDelay }: DurableAgentTestContext) {
  describe('memory integration', () => {
    it('should track threadId and resourceId in stream result', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'memory-test-agent',
        name: 'Memory Test Agent',
        instructions: 'Test',
        model: mockModel,
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

    it('should handle streaming without memory options', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'no-memory-agent',
        name: 'No Memory Agent',
        instructions: 'Test',
        model: mockModel,
      });

      const { threadId, resourceId, cleanup } = await agent.stream('Test');

      expect(threadId).toBeUndefined();
      expect(resourceId).toBeUndefined();

      cleanup();
    });

    it('should handle thread object with id', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'thread-object-agent',
        name: 'Thread Object Agent',
        instructions: 'Test',
        model: mockModel,
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
