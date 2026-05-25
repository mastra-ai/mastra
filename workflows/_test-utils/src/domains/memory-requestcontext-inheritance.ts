/**
 * RequestContext memory isolation tests for DurableAgent
 *
 * Tests that memory configurations are independent across
 * different prepare() calls and agents.
 */

import { describe, it, expect } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createMemoryRequestContextInheritanceTests(context: DurableAgentTestContext) {
  const { createAgent } = context;

  describe('RequestContext memory isolation', () => {
    it('should produce independent workflowInputs for different memory configs', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'isolation-agent',
        instructions: 'Test isolation',
        model: mockModel,
      });

      const result1 = await agent.prepare('Hello', {
        memory: {
          thread: 'thread-a',
          resource: 'user-a',
          options: { readOnly: true },
        },
      });

      const result2 = await agent.prepare('Hello', {
        memory: {
          thread: 'thread-b',
          resource: 'user-b',
          options: { readOnly: false },
        },
      });

      // Each prepare should produce independent state
      expect(result1.workflowInput.state.threadId).toBe('thread-a');
      expect(result2.workflowInput.state.threadId).toBe('thread-b');
      expect(result1.workflowInput.state.memoryConfig.readOnly).toBe(true);
      expect(result2.workflowInput.state.memoryConfig.readOnly).toBe(false);
    });

    it('should serialize different readOnly values for sequential agents', async () => {
      const mockModel1 = createTextStreamModel('Agent 1');
      const mockModel2 = createTextStreamModel('Agent 2');

      const agent1 = await createAgent({
        id: 'seq-agent-1',
        instructions: 'Agent 1 with readOnly',
        model: mockModel1,
      });

      const agent2 = await createAgent({
        id: 'seq-agent-2',
        instructions: 'Agent 2 without readOnly',
        model: mockModel2,
      });

      const result1 = await agent1.prepare('Hello', {
        memory: {
          thread: 'shared-thread',
          resource: 'shared-user',
          options: { readOnly: true },
        },
      });

      const result2 = await agent2.prepare('Hello', {
        memory: {
          thread: 'shared-thread',
          resource: 'shared-user',
          options: { readOnly: false },
        },
      });

      expect(result1.workflowInput.state.memoryConfig.readOnly).toBe(true);
      expect(result2.workflowInput.state.memoryConfig.readOnly).toBe(false);
    });
  });
}
