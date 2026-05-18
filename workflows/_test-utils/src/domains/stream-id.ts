/**
 * Stream ID tests for DurableAgent
 *
 * Tests that run IDs and message IDs are properly generated
 * and consistent across prepare() and stream() calls.
 */

import { describe, it, expect } from 'vitest';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createStreamIdTests(context: DurableAgentTestContext) {
  const { createAgent } = context;

  describe('stream ID consistency', () => {
    it('should return a runId from stream', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'stream-id-agent',
        instructions: 'Test stream ID',
        model: mockModel,
      });

      const { runId, cleanup } = await agent.stream('Hello');

      expect(runId).toBeDefined();
      expect(typeof runId).toBe('string');
      expect(runId.length).toBeGreaterThan(0);

      cleanup();
    });

    it('should generate messageId in workflow input', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = await createAgent({
        id: 'message-id-agent',
        instructions: 'Test message ID',
        model: mockModel,
      });

      const result = await agent.prepare('Hello');

      expect(result.messageId).toBeDefined();
      expect(typeof result.messageId).toBe('string');
      expect(result.messageId.length).toBeGreaterThan(0);
    });

    it('should generate unique runIds across agents', async () => {
      const mockModel1 = createTextStreamModel('Hello');
      const mockModel2 = createTextStreamModel('World');

      const agent1 = await createAgent({
        id: 'unique-id-agent-1',
        instructions: 'Test unique IDs',
        model: mockModel1,
      });

      const agent2 = await createAgent({
        id: 'unique-id-agent-2',
        instructions: 'Test unique IDs',
        model: mockModel2,
      });

      const result1 = await agent1.prepare('Hello');
      const result2 = await agent2.prepare('World');

      expect(result1.runId).not.toBe(result2.runId);
      expect(result1.messageId).not.toBe(result2.messageId);
    });
  });
}
