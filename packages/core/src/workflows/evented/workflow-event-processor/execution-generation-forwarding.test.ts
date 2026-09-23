import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import { MockStore } from '../../../storage/mock';
import { createStep, createWorkflow } from '../../evented';

/**
 * PF-4387: every `updateWorkflowResults` callsite must forward the run's
 * lifecycle `executionGeneration` so storage boundaries can fence delayed
 * result writes from a deleted lifetime (PF-4385 generation-aware tombstone
 * reopen). A real evented run drives the callsites; the spy asserts the
 * forwarded identity on each one the run reaches.
 */
type RecordedResultWrite = {
  workflowName: string;
  runId: string;
  stepId: string;
  result: any;
  executionGeneration?: string;
};

function recordResultWrites(workflowsStore: WorkflowsStorage): RecordedResultWrite[] {
  const seen: RecordedResultWrite[] = [];
  const updateWorkflowResults = workflowsStore.updateWorkflowResults.bind(workflowsStore);
  vi.spyOn(workflowsStore, 'updateWorkflowResults').mockImplementation(async args => {
    seen.push({
      workflowName: args.workflowName,
      runId: args.runId,
      stepId: args.stepId,
      result: args.result,
      executionGeneration: args.executionGeneration,
    });
    return updateWorkflowResults(args);
  });
  return seen;
}

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
    const seen = recordResultWrites(workflowsStore);

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
      expect(seen.every(call => call.executionGeneration === generation)).toBe(true);
    } finally {
      await mastra.shutdown();
    }
  });

  it('forwards the run executionGeneration on foreach iteration writes', async () => {
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const body = createStep({
      id: 'foreach-body',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData }) => inputData * 2,
    });
    const workflow = createWorkflow({
      id: `foreach-forwarding-${Math.random().toString(36).slice(2)}`,
      inputSchema: z.array(z.number()),
      outputSchema: z.array(z.number()),
    })
      .foreach(body)
      .commit();
    const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { [workflow.id]: workflow } });
    const workflowsStore = (await storage.getStore('workflows'))!;
    const seen = recordResultWrites(workflowsStore);

    await mastra.startWorkers();
    try {
      const runId = `run-${Math.random().toString(36).slice(2)}`;
      const run = await workflow.createRun({ runId });
      const pending = (await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId }))!;
      const generation = pending.executionGeneration!;
      expect(generation).toBeTruthy();

      const result = await run.start({ inputData: [1, 2] });
      expect(result.status).toBe('success');

      // processWorkflowForEach persists the aggregate foreach result (array
      // output) on kick-off, on each subsequent iteration, and on completion —
      // every one of those loop.ts writes must carry the run's generation.
      expect(seen.some(call => call.stepId === body.id && Array.isArray(call.result?.output))).toBe(true);
      expect(seen.every(call => call.executionGeneration === generation)).toBe(true);
    } finally {
      await mastra.shutdown();
    }
  });

  it('forwards the run executionGeneration on loop iteration writes', async () => {
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const body = createStep({
      id: 'loop-body',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.number() }),
      execute: async () => ({ value: 1 }),
    });
    const workflow = createWorkflow({
      id: `loop-forwarding-${Math.random().toString(36).slice(2)}`,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.number() }),
    })
      .dountil(body, async ({ iterationCount }) => iterationCount >= 2)
      .commit();
    const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { [workflow.id]: workflow } });
    const workflowsStore = (await storage.getStore('workflows'))!;
    const seen = recordResultWrites(workflowsStore);

    await mastra.startWorkers();
    try {
      const runId = `run-${Math.random().toString(36).slice(2)}`;
      const run = await workflow.createRun({ runId });
      const pending = (await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId }))!;
      const generation = pending.executionGeneration!;
      expect(generation).toBeTruthy();

      const result = await run.start({ inputData: {} });
      expect(result.status).toBe('success');

      // persistNextIteration records the next-iteration marker before
      // re-dispatching the loop body — the one loop.ts write this run reaches.
      expect(seen.some(call => call.stepId === body.id && call.result?.metadata?.iterationCount === 1)).toBe(true);
      expect(seen.every(call => call.executionGeneration === generation)).toBe(true);
    } finally {
      await mastra.shutdown();
    }
  });

  it('forwards the parent executionGeneration on the nested-run ownership fallback', async () => {
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const childStep = createStep({
      id: 'nested-child-step',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
      execute: async () => ({ value: 'child-done' }),
    });
    const nestedWorkflow = createWorkflow({
      id: `nested-forwarding-child-${Math.random().toString(36).slice(2)}`,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
      steps: [childStep],
    })
      .then(childStep)
      .commit();
    const workflow = createWorkflow({
      id: `nested-forwarding-parent-${Math.random().toString(36).slice(2)}`,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
      steps: [nestedWorkflow],
    })
      .then(nestedWorkflow)
      .commit();
    const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { [workflow.id]: workflow } });
    const workflowsStore = (await storage.getStore('workflows'))!;
    const seen = recordResultWrites(workflowsStore);
    // Force the pre-recovery nested-ownership lane: without terminal recovery
    // the processor binds the child through bindWorkflowNestedRunOwnership,
    // and a store without that lane falls back to updateWorkflowResults with
    // the parent run's own executionGeneration.
    vi.spyOn(workflowsStore, 'getWorkflowTerminalizationCapabilities').mockReturnValue({});
    const bindSpy = vi
      .spyOn(workflowsStore, 'bindWorkflowNestedRunOwnership')
      .mockResolvedValue({ status: 'unsupported' });

    await mastra.startWorkers();
    try {
      const runId = `run-${Math.random().toString(36).slice(2)}`;
      const run = await workflow.createRun({ runId });
      const pending = (await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId }))!;
      const generation = pending.executionGeneration!;
      expect(generation).toBeTruthy();

      const result = await run.start({ inputData: {} });
      expect(result.status).toBe('success');

      // The nested start bound through the mocked-unsupported lane, so the
      // fallback updateWorkflowResults write carried the parent's generation.
      expect(bindSpy).toHaveBeenCalled();
      // The fallback write targets the parent run under the nested step id.
      expect(seen.some(call => call.runId === runId && call.stepId === nestedWorkflow.id)).toBe(true);
      // Every recorded write carries the generation of the run it targets:
      // the parent's own generation on parent-targeted calls (the fallback),
      // the nested run's own generation on child-targeted calls.
      const targetGenerations = new Map<string, string | undefined>();
      for (const call of seen) {
        if (!targetGenerations.has(call.runId)) {
          const snapshot = await workflowsStore.loadWorkflowSnapshot({
            workflowName: call.workflowName,
            runId: call.runId,
          });
          targetGenerations.set(call.runId, snapshot?.executionGeneration);
        }
        const expected = targetGenerations.get(call.runId);
        expect(expected).toBeTruthy();
        expect(call.executionGeneration).toBe(expected);
      }
    } finally {
      await mastra.shutdown();
    }
  });

  it('forwards the run executionGeneration on suspension writes', async () => {
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const suspendingStep = createStep({
      id: 'suspending-step',
      inputSchema: z.object({}),
      suspendSchema: z.object({ reason: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ suspend }) => {
        await suspend({ reason: 'waiting' });
        return { value: 'resumed' };
      },
    });
    const workflow = createWorkflow({
      id: `suspend-forwarding-${Math.random().toString(36).slice(2)}`,
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.string() }),
    })
      .then(suspendingStep)
      .commit();
    const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { [workflow.id]: workflow } });
    const workflowsStore = (await storage.getStore('workflows'))!;
    const seen = recordResultWrites(workflowsStore);

    await mastra.startWorkers();
    try {
      const runId = `run-${Math.random().toString(36).slice(2)}`;
      const run = await workflow.createRun({ runId });
      const pending = (await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId }))!;
      const generation = pending.executionGeneration!;
      expect(generation).toBeTruthy();

      const result = await run.start({ inputData: {} });
      expect(result.status).toBe('suspended');

      // Suspension persists the step result and the '__state' context entry.
      expect(seen.some(call => call.stepId === '__state')).toBe(true);
      expect(seen.every(call => call.executionGeneration === generation)).toBe(true);
    } finally {
      await mastra.shutdown();
    }
  });
});
