/**
 * Background task tests for DurableAgent
 *
 * Tests that background task configuration and state
 * are properly wired through the durable execution pipeline.
 */

import { describe, it, expect } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { baseIterationStateSchema } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createBackgroundTaskTests(context: DurableAgentTestContext) {
  const { getPubSub } = context;

  describe('background task wiring', () => {
    it('should serialize skipBgTaskWait flag in workflow input options', async () => {
      const agent = new Agent({
        id: 'skip-bg-agent',
        name: 'Skip BG Agent',
        instructions: 'Test',
        model: createTextStreamModel('Hello'),
      });

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const result = await durableAgent.prepare('Hello', {
        _skipBgTaskWait: true,
      } as any);

      expect(result.workflowInput.options.skipBgTaskWait).toBe(true);
    });

    it('should not set skipBgTaskWait when not provided', async () => {
      const agent = new Agent({
        id: 'no-skip-agent',
        name: 'No Skip Agent',
        instructions: 'Test',
        model: createTextStreamModel('Hello'),
      });

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const result = await durableAgent.prepare('Hello');

      expect(result.workflowInput.options.skipBgTaskWait).toBeUndefined();
    });

    it('should stash backgroundTaskManager in registry entry when mastra has bg tasks enabled', async () => {
      const agent = new Agent({
        id: 'bg-registry-agent',
        name: 'BG Registry Agent',
        instructions: 'Test',
        model: createTextStreamModel('Hello'),
        backgroundTasks: { tools: { someTool: true } },
      });

      const durableAgent = createDurableAgent({
        agent,
        pubsub: getPubSub(),
      });

      const mastra = new Mastra({
        logger: false,
        storage: new MockStore(),
        backgroundTasks: { enabled: true },
        agents: { 'bg-registry-agent': durableAgent as any },
      });

      const result = await durableAgent.prepare('Hello');

      expect(result.registryEntry.backgroundTaskManager).toBeDefined();
      expect(result.registryEntry.backgroundTasksConfig).toBeDefined();

      await mastra.backgroundTaskManager?.shutdown();
    });

    it('should include backgroundTaskPending in iteration state schema', async () => {
      const shape = baseIterationStateSchema.shape;
      expect(shape.backgroundTaskPending).toBeDefined();
    });
  });
}
