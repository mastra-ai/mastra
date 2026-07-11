/**
 * Memory persistence tests for DurableAgent
 *
 * Tests that savePerStep and observationalMemory flags
 * are properly serialized into the durable workflow input.
 */

import { describe, it, expect } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createMemoryPersistenceTests(context: DurableAgentTestContext) {
  const { getPubSub } = context;

  describe('memory persistence flags', () => {
    it('should serialize savePerStep flag in workflow input state', async () => {
      const agent = new Agent({
        id: 'save-step-agent',
        name: 'Save Step Agent',
        instructions: 'Test',
        model: createTextStreamModel('Hello'),
      });

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const result = await durableAgent.prepare('Hello', {
        savePerStep: true,
      } as any);

      expect(result.workflowInput.state.savePerStep).toBe(true);
    });

    it('should serialize observationalMemory flag in workflow input state', async () => {
      const agent = new Agent({
        id: 'om-agent',
        name: 'OM Agent',
        instructions: 'Test',
        model: createTextStreamModel('Hello'),
      });

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const result = await durableAgent.prepare('Hello', {
        memory: {
          options: {
            observationalMemory: true,
          },
        },
      } as any);

      expect(result.workflowInput.state.observationalMemory).toBe(true);
    });

    it('should default persistence flags to undefined when not set', async () => {
      const agent = new Agent({
        id: 'default-flags-agent',
        name: 'Default Flags Agent',
        instructions: 'Test',
        model: createTextStreamModel('Hello'),
      });

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const result = await durableAgent.prepare('Hello');

      expect(result.workflowInput.state.savePerStep).toBeUndefined();
      expect(result.workflowInput.state.observationalMemory).toBeFalsy();
    });
  });
}
