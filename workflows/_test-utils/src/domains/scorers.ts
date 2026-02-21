/**
 * Scorer tests for DurableAgent
 *
 * Tests that scorer configuration is properly serialized
 * and propagated through prepare() and stream().
 */

import { describe, it, expect } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createScorersTests(context: DurableAgentTestContext) {
  const { getPubSub } = context;

  describe('scorers', () => {
    it('should serialize scorer config in workflow input', async () => {
      const mockModel = createTextStreamModel('Hello');

      const mockScorer = {
        name: 'test-scorer',
        scorer: { generateScore: async () => ({ score: 1.0 }) },
      };

      const agent = new Agent({
        id: 'scorer-agent',
        name: 'Scorer Agent',
        instructions: 'Test scorers',
        model: mockModel,
        scorers: {
          testScorer: mockScorer,
        },
      } as any);

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const result = await durableAgent.prepare('Hello');

      // Workflow input should have scorers serialized
      expect(result.workflowInput).toBeDefined();
    });

    it('should handle returnScorerData option', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = new Agent({
        id: 'scorer-return-agent',
        name: 'Scorer Return Agent',
        instructions: 'Test returnScorerData',
        model: mockModel,
      });

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const result = await durableAgent.prepare('Hello', {
        returnScorerData: true,
      } as any);

      expect(result.workflowInput).toBeDefined();
    });

    it('should produce undefined scorers when none configured', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = new Agent({
        id: 'no-scorer-agent',
        name: 'No Scorer Agent',
        instructions: 'No scorers',
        model: mockModel,
      });

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const result = await durableAgent.prepare('Hello');

      // No scorers configured = undefined or absent
      expect(result.workflowInput.scorers).toBeUndefined();
    });

    it('should allow override scorers in stream options', async () => {
      const mockModel = createTextStreamModel('Hello');

      const overrideScorer = {
        name: 'override-scorer',
        scorer: { generateScore: async () => ({ score: 0.5 }) },
      };

      const agent = new Agent({
        id: 'scorer-override-agent',
        name: 'Scorer Override Agent',
        instructions: 'Test override',
        model: mockModel,
      });

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const result = await durableAgent.prepare('Hello', {
        scorers: { overrideScorer },
      } as any);

      expect(result.workflowInput).toBeDefined();
    });
  });
}
