import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createStep, createWorkflow } from '../../evented';

/**
 * PF-4387: every `updateWorkflowResults` callsite must forward the run's
 * lifecycle `executionGeneration` so storage boundaries can fence delayed
 * result writes from a deleted lifetime (PF-4385 generation-aware tombstone
 * reopen). A real evented run drives the callsites; the spy asserts the
 * forwarded identity on each one the run reaches.
 */
describe('updateWorkflowResults executionGeneration forwarding', () => {
  it('forwards the run executionGeneration on every result write', async () => {
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const step = createStep({
      id: 'forwarding-step',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
      execute: async () => ({ value: 'done' }),
    });
    const workflow = createWorkflow({
      id: `forwarding-${Math.random().toString(36).slice(2)}`,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    })
      .then(step)
      .commit();
    const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { [workflow.id]: workflow } });
    const workflowsStore = (await storage.getStore('workflows'))!;
    const seen: Array<string | undefined> = [];
    const updateWorkflowResults = workflowsStore.updateWorkflowResults.bind(workflowsStore);
    vi.spyOn(workflowsStore, 'updateWorkflowResults').mockImplementation(async args => {
      seen.push((args as { executionGeneration?: string }).executionGeneration);
      return updateWorkflowResults(args);
    });

    await mastra.startWorkers();
    try {
      const runId = `run-${Math.random().toString(36).slice(2)}`;
      const run = await workflow.createRun({ runId });
      const pending = (await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId }))!;
      const generation = pending.executionGeneration!;
      expect(generation).toBeTruthy();

      const result = await run.start({ inputData: {} });
      expect(result.status).toBe('success');

      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every(generationSeen => generationSeen === generation)).toBe(true);
    } finally {
      await mastra.shutdown();
    }
  });
});
