/**
 * Regression for https://github.com/mastra-ai/mastra/issues/24984.
 *
 * Evented workflows (including scheduled ones) that opt in via
 * `options.autoRestartActiveRuns: true` are recovered by the boot-time sweep
 * `Mastra.restartAllActiveWorkflowRuns()` after a process restart. Evented
 * workflows that don't opt in are left untouched.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import { MockStore } from '../storage/mock';
import { createStep, createWorkflow } from '../workflows/evented';
import { Mastra } from './index';

const looseObject = z.looseObject({});
type StepExecute = (params: { inputData: any }) => Promise<any>;

function makeWorkflow(
  id: string,
  step1Execute: StepExecute,
  step2Execute: StepExecute,
  options?: { autoRestartActiveRuns?: boolean },
) {
  const step1 = createStep({ id: 'step1', execute: step1Execute, inputSchema: looseObject, outputSchema: looseObject });
  const step2 = createStep({ id: 'step2', execute: step2Execute, inputSchema: looseObject, outputSchema: looseObject });
  return createWorkflow({
    id,
    inputSchema: looseObject,
    outputSchema: looseObject,
    steps: [step1, step2],
    options,
  })
    .then(step1)
    .then(step2)
    .commit();
}

function newHost(workflow: ReturnType<typeof makeWorkflow>, storage: MockStore) {
  return new Mastra({
    logger: false,
    storage,
    workflows: { [workflow.id]: workflow as any },
    pubsub: new EventEmitterPubSub(),
  });
}

/** Host A starts a run whose step2 never resolves, simulating a killed process. */
async function orphanRun(id: string, storage: MockStore, options?: { autoRestartActiveRuns?: boolean }) {
  let signal!: () => void;
  const step2Started = new Promise<void>(resolve => (signal = resolve));
  const workflow = makeWorkflow(
    id,
    async () => ({ seed: 'from-step1' }),
    async () => {
      signal();
      await new Promise<never>(() => {});
    },
    options,
  );
  const mastra = newHost(workflow, storage);
  await mastra.startWorkers();
  const runId = `${id}-run`;
  const run = await workflow.createRun({ runId });
  run.start({ inputData: {} }).catch(() => {});
  await step2Started;
  return { mastra, runId };
}

async function waitForStatus(storage: MockStore, workflowName: string, runId: string, status: string) {
  const store = await storage.getStore('workflows');
  await vi.waitFor(
    async () => {
      const snapshot = await store!.loadWorkflowSnapshot({ workflowName, runId });
      expect(snapshot?.status).toBe(status);
    },
    { timeout: 5000 },
  );
}

describe('Mastra.restartAllActiveWorkflowRuns with evented workflows (issue #24984)', () => {
  it('recovers opted-in evented runs without re-running completed steps', async () => {
    const storage = new MockStore();
    const id = 'evented-opt-in';
    const { mastra: hostA, runId } = await orphanRun(id, storage, { autoRestartActiveRuns: true });

    const step1B = vi.fn(async () => ({ seed: 'should-not-run' }));
    const step2B = vi.fn(async ({ inputData }: { inputData: any }) => ({ got: inputData.seed }));
    const hostB = newHost(makeWorkflow(id, step1B, step2B, { autoRestartActiveRuns: true }), storage);
    await hostB.startWorkers();
    try {
      const active = await hostB.listActiveWorkflowRuns();
      expect(active.runs.map(r => r.runId)).toEqual([runId]);

      await hostB.restartAllActiveWorkflowRuns();
      await waitForStatus(storage, id, runId, 'success');

      expect(step1B).not.toHaveBeenCalled();
      expect(step2B).toHaveBeenCalledTimes(1);
      expect(step2B.mock.calls[0]![0].inputData).toEqual({ seed: 'from-step1' });
    } finally {
      await hostB.stopWorkers();
      await hostA.stopWorkers();
    }
  });

  it('defers evented restarts requested before workers start', async () => {
    const storage = new MockStore();
    const id = 'evented-before-workers';
    const { mastra: hostA, runId } = await orphanRun(id, storage, { autoRestartActiveRuns: true });

    const step2B = vi.fn(async ({ inputData }: { inputData: any }) => ({ got: inputData.seed }));
    const hostB = newHost(
      makeWorkflow(id, async () => ({}), step2B, { autoRestartActiveRuns: true }),
      storage,
    );
    try {
      await hostB.restartAllActiveWorkflowRuns();
      await hostB.startWorkers();
      await waitForStatus(storage, id, runId, 'success');
      expect(step2B).toHaveBeenCalledTimes(1);
    } finally {
      await hostB.stopWorkers();
      await hostA.stopWorkers();
    }
  });

  it('keeps evented restarts queued through a named partial worker start', async () => {
    const storage = new MockStore();
    const id = 'evented-partial-start';
    const { mastra: hostA, runId } = await orphanRun(id, storage, { autoRestartActiveRuns: true });

    const step2B = vi.fn(async ({ inputData }: { inputData: any }) => ({ got: inputData.seed }));
    const hostB = newHost(
      makeWorkflow(id, async () => ({}), step2B, { autoRestartActiveRuns: true }),
      storage,
    );
    try {
      await hostB.restartAllActiveWorkflowRuns();
      await hostB.startWorkers('orchestration');
      // Recovery requested after a partial start must still wait for the consumer.
      await hostB.restartAllActiveWorkflowRuns();
      expect(step2B).not.toHaveBeenCalled();

      await hostB.startWorkers();
      await waitForStatus(storage, id, runId, 'success');
      expect(step2B).toHaveBeenCalledTimes(1);
    } finally {
      await hostB.stopWorkers();
      await hostA.stopWorkers();
    }
  });

  it('leaves evented runs untouched when the workflow does not opt in', async () => {
    const storage = new MockStore();
    const id = 'evented-no-opt-in';
    const { mastra: hostA, runId } = await orphanRun(id, storage);

    const step2B = vi.fn(async () => ({}));
    const workflowB = makeWorkflow(id, async () => ({}), step2B);
    const hostB = newHost(workflowB, storage);
    await hostB.startWorkers();
    try {
      expect((await hostB.listActiveWorkflowRuns()).runs).toEqual([]);
      await hostB.restartAllActiveWorkflowRuns();
      const store = await storage.getStore('workflows');
      const snapshot = await store!.loadWorkflowSnapshot({ workflowName: id, runId });
      expect(snapshot?.status).toBe('running');
      expect(step2B).not.toHaveBeenCalled();
    } finally {
      await hostB.stopWorkers();
      await hostA.stopWorkers();
    }
  });
});
