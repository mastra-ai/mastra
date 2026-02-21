/**
 * Input processor tests for DurableAgent
 *
 * Tests that agents with input processors can properly
 * prepare() and stream() without errors.
 */

import { describe, it, expect } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createInputProcessorsTests(context: DurableAgentTestContext) {
  const { getPubSub } = context;

  describe('input processors', () => {
    it('should prepare without error when inputProcessors configured', async () => {
      const mockModel = createTextStreamModel('Hello');

      const mockProcessor = {
        id: 'test-processor',
        processInput: async ({ messages }: any) => ({ messages }),
      };

      const agent = new Agent({
        id: 'processor-agent',
        name: 'Processor Agent',
        instructions: 'Test input processors',
        model: mockModel,
        inputProcessors: [mockProcessor],
      } as any);

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const result = await durableAgent.prepare('Hello');

      expect(result.runId).toBeDefined();
      expect(result.workflowInput).toBeDefined();
    });

    it('should stream with input processors', async () => {
      const mockModel = createTextStreamModel('Processed response');

      const mockProcessor = {
        id: 'stream-processor',
        processInput: async ({ messages }: any) => ({ messages }),
      };

      const agent = new Agent({
        id: 'stream-processor-agent',
        name: 'Stream Processor Agent',
        instructions: 'Test streaming with processors',
        model: mockModel,
        inputProcessors: [mockProcessor],
      } as any);

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const { runId, cleanup } = await durableAgent.stream('Hello');

      expect(runId).toBeDefined();

      cleanup();
    });

    it('should handle empty processors array', async () => {
      const mockModel = createTextStreamModel('Hello');

      const agent = new Agent({
        id: 'empty-processor-agent',
        name: 'Empty Processor Agent',
        instructions: 'Test empty processors',
        model: mockModel,
        inputProcessors: [],
      } as any);

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const result = await durableAgent.prepare('Hello');

      expect(result.runId).toBeDefined();
      expect(result.workflowInput).toBeDefined();
    });
  });
}
