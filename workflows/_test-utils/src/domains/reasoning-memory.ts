/**
 * Reasoning + Memory integration tests for DurableAgent
 *
 * Tests that DurableAgent can handle reasoning-capable models
 * without crashing, and that memory config serializes correctly
 * with reasoning models.
 */

import { describe, it, expect } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel, createReasoningStreamModel } from '../mock-models';

export function createReasoningMemoryTests(context: DurableAgentTestContext) {
  const { createAgent } = context;

  describe('reasoning + memory integration', () => {
    it('should complete stream with reasoning-capable model', async () => {
      const mockModel = createReasoningStreamModel('Thinking about this...', 'Here is my answer');

      const agent = await createAgent({
        id: 'reasoning-stream-agent',
        instructions: 'Test reasoning streaming',
        model: mockModel,
      });

      const { runId, cleanup } = await agent.stream('Explain something');

      expect(runId).toBeDefined();

      cleanup();
    });

    it('should serialize memory config with reasoning model', async () => {
      const mockModel = createReasoningStreamModel('Let me think...', 'The answer is 42');

      const agent = await createAgent({
        id: 'reasoning-memory-agent',
        instructions: 'Test reasoning with memory',
        model: mockModel,
      });

      const result = await agent.prepare('What is the answer?', {
        memory: {
          thread: 'reasoning-thread',
          resource: 'reasoning-user',
          options: { lastMessages: 5 },
        },
      });

      expect(result.workflowInput.state.threadId).toBe('reasoning-thread');
      expect(result.workflowInput.state.resourceId).toBe('reasoning-user');
      expect(result.workflowInput.state.memoryConfig).toBeDefined();
      expect(result.workflowInput.state.memoryConfig.lastMessages).toBe(5);
    });

    it('should handle reasoning model without memory', async () => {
      const mockModel = createReasoningStreamModel('Reasoning...', 'Done');

      const agent = await createAgent({
        id: 'reasoning-no-memory-agent',
        instructions: 'Reasoning without memory',
        model: mockModel,
      });

      const result = await agent.prepare('Hello');

      expect(result.runId).toBeDefined();
      expect(result.workflowInput).toBeDefined();
    });
  });
}
