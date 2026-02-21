/**
 * Memory metadata tests for DurableAgent
 *
 * Tests that thread metadata is properly handled
 * in prepare() and stream() calls.
 */

import { describe, it, expect } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createMemoryMetadataTests(context: DurableAgentTestContext) {
  const { createAgent } = context;

  describe('memory metadata', () => {
    it('should handle thread with metadata in prepare', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'metadata-agent',
        instructions: 'Test metadata',
        model: mockModel,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: { id: 'meta-thread-1', metadata: { client: 'web', version: '2.0' } },
          resource: 'meta-user-1',
        },
      });

      expect(result.workflowInput.state.threadId).toBe('meta-thread-1');
      expect(result.workflowInput.state.resourceId).toBe('meta-user-1');
    });

    it('should extract threadId from object format', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'thread-obj-meta-agent',
        instructions: 'Test thread object',
        model: mockModel,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: { id: 'obj-thread-123' },
          resource: 'obj-user-456',
        },
      });

      expect(result.workflowInput.state.threadId).toBe('obj-thread-123');
    });

    it('should return correct threadId from stream with metadata', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'stream-meta-agent',
        instructions: 'Test stream metadata',
        model: mockModel,
      });

      const { threadId, resourceId, cleanup } = await agent.stream('Hello', {
        memory: {
          thread: { id: 'stream-meta-thread', metadata: { source: 'api' } },
          resource: 'stream-meta-user',
        },
      });

      expect(threadId).toBe('stream-meta-thread');
      expect(resourceId).toBe('stream-meta-user');

      cleanup();
    });
  });
}
