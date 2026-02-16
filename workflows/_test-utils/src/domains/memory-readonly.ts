/**
 * Memory readOnly option tests for DurableAgent
 *
 * Tests that the readOnly flag is properly serialized
 * in the workflow input state.
 */

import { describe, it, expect } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createMemoryReadonlyTests(context: DurableAgentTestContext) {
  const { createAgent } = context;

  describe('memory readOnly option', () => {
    it('should serialize readOnly: true in workflow input', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'readonly-true-agent',
        instructions: 'Test readOnly true',
        model: mockModel,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: 'thread-1',
          resource: 'user-1',
          options: { readOnly: true },
        },
      });

      expect(result.workflowInput.state.memoryConfig).toBeDefined();
      expect(result.workflowInput.state.memoryConfig.readOnly).toBe(true);
    });

    it('should serialize readOnly: false in workflow input', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'readonly-false-agent',
        instructions: 'Test readOnly false',
        model: mockModel,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: 'thread-2',
          resource: 'user-2',
          options: { readOnly: false },
        },
      });

      expect(result.workflowInput.state.memoryConfig).toBeDefined();
      expect(result.workflowInput.state.memoryConfig.readOnly).toBe(false);
    });

    it('should handle absent readOnly option', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'no-readonly-agent',
        instructions: 'Test no readOnly',
        model: mockModel,
      });

      const result = await agent.prepare('Hello', {
        memory: {
          thread: 'thread-3',
          resource: 'user-3',
        },
      });

      // Without options, memoryConfig should be undefined
      expect(result.workflowInput.state.memoryConfig).toBeUndefined();
    });

    it('should complete stream with readOnly option', async () => {
      const mockModel = createTextStreamModel('Hello with readOnly');

      const agent = await createAgent({
        id: 'readonly-stream-agent',
        instructions: 'Test stream readOnly',
        model: mockModel,
      });

      const { runId, cleanup } = await agent.stream('Hello', {
        memory: {
          thread: 'thread-readonly-stream',
          resource: 'user-readonly-stream',
          options: { readOnly: true },
        },
      });

      expect(runId).toBeDefined();

      cleanup();
    });
  });
}
