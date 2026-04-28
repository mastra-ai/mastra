/**
 * Title generation tests for DurableAgent
 *
 * Tests that agents with title generation config
 * can prepare() and stream() without issues.
 */

import { describe, it, expect } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createTitleGenerationTests(context: DurableAgentTestContext) {
  const { createAgent } = context;

  describe('title generation', () => {
    it('should complete stream with agent that could trigger title generation', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'title-gen-agent',
        instructions: 'Test title generation',
        model: mockModel,
      });

      const { runId, cleanup } = await agent.stream('Hello', {
        memory: {
          thread: 'title-thread',
          resource: 'title-user',
        },
      });

      expect(runId).toBeDefined();

      cleanup();
    });

    it('should serialize thread metadata in prepare', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'title-meta-agent',
        instructions: 'Test title metadata',
        model: mockModel,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: { id: 'meta-thread', metadata: { client: 'web' } },
          resource: 'meta-user',
        },
      });

      expect(result.workflowInput.state.threadId).toBe('meta-thread');
    });

    it('should prepare without memory options', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'no-title-agent',
        instructions: 'No title generation',
        model: mockModel,
      });

      const result = await agent.prepare('Hello');

      expect(result.runId).toBeDefined();
      expect(result.workflowInput.state.threadId).toBeUndefined();
    });
  });
}
