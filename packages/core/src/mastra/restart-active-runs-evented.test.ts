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

  it('drains deferred evented restarts when execution workers start lazily', async () => {
    const storage = new MockStore();
    const id = 'evented-lazy-start';
    const { mastra: hostA, runId } = await orphanRun(id, storage, { autoRestartActiveRuns: true });

    const step2B = vi.fn(async ({ inputData }: { inputData: any }) => ({ got: inputData.seed }));
    const hostB = newHost(
      makeWorkflow(id, async () => ({}), step2B, { autoRestartActiveRuns: true }),
      storage,
    );
    try {
      await hostB.restartAllActiveWorkflowRuns();
      await hostB.__ensureExecutionWorkersStarted();
      await waitForStatus(storage, id, runId, 'success');
      expect(step2B).toHaveBeenCalledTimes(1);
    } finally {
      await hostB.stopWorkers();
      await hostA.stopWorkers();
    }
  });

  it('does not block startWorkers on recovered runs and drives each run once', async () => {
    const storage = new MockStore();
    const id = 'evented-nonblocking';
    const { mastra: hostA, runId } = await orphanRun(id, storage, { autoRestartActiveRuns: true });

    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const step2B = vi.fn(async () => {
      await gate;
      return {};
    });
    const hostB = newHost(
      makeWorkflow(id, async () => ({}), step2B, { autoRestartActiveRuns: true }),
      storage,
    );
    try {
      await hostB.restartAllActiveWorkflowRuns();
      await hostB.startWorkers();
      await vi.waitFor(() => expect(step2B).toHaveBeenCalledTimes(1));

      // A second sweep while the recovered run is still in flight must not drive it again.
      await hostB.restartAllActiveWorkflowRuns();
      release();
      await waitForStatus(storage, id, runId, 'success');
      expect(step2B).toHaveBeenCalledTimes(1);
    } finally {
      release();
      await hostB.stopWorkers();
      await hostA.stopWorkers();
    }
  });

  it('recovers runs from different workflows that share a runId', async () => {
    const storage = new MockStore();
    const runId = 'shared-run';
    const started: Array<() => void> = [];
    const hang = (i: number) => async () => {
      started[i]!();
      await new Promise<never>(() => {});
    };
    const waits = [0, 1].map(i => new Promise<void>(resolve => (started[i] = resolve)));
    const a1 = makeWorkflow('shared-a', async () => ({ seed: 'a' }), hang(0), { autoRestartActiveRuns: true });
    const a2 = makeWorkflow('shared-b', async () => ({ seed: 'b' }), hang(1), { autoRestartActiveRuns: true });
    const hostA = new Mastra({
      logger: false,
      storage,
      workflows: { [a1.id]: a1 as any, [a2.id]: a2 as any },
      pubsub: new EventEmitterPubSub(),
    });
    await hostA.startWorkers();
    for (const wf of [a1, a2]) (await wf.createRun({ runId })).start({ inputData: {} }).catch(() => {});
    await Promise.all(waits);

    const stepA = vi.fn(async () => ({}));
    const stepB = vi.fn(async () => ({}));
    const b1 = makeWorkflow('shared-a', async () => ({}), stepA, { autoRestartActiveRuns: true });
    const b2 = makeWorkflow('shared-b', async () => ({}), stepB, { autoRestartActiveRuns: true });
    const hostB = new Mastra({
      logger: false,
      storage,
      workflows: { [b1.id]: b1 as any, [b2.id]: b2 as any },
      pubsub: new EventEmitterPubSub(),
    });
    try {
      await hostB.restartAllActiveWorkflowRuns();
      await hostB.startWorkers();
      await waitForStatus(storage, 'shared-a', runId, 'success');
      await waitForStatus(storage, 'shared-b', runId, 'success');
      expect(stepA).toHaveBeenCalledTimes(1);
      expect(stepB).toHaveBeenCalledTimes(1);
    } finally {
      await hostB.stopWorkers();
      await hostA.stopWorkers();
    }
  });

  it('skips evented runs with an unparseable snapshot or no recorded position and keeps sweeping', async () => {
    const storage = new MockStore();
    const id = 'evented-unrecoverable';
    const { mastra: hostA, runId } = await orphanRun(id, storage, { autoRestartActiveRuns: true });

    const step2B = vi.fn(async () => ({}));
    const workflowB = makeWorkflow(id, async () => ({}), step2B, { autoRestartActiveRuns: true });
    const hostB = newHost(workflowB, storage);
    const realList = hostB.listActiveWorkflowRuns.bind(hostB);
    vi.spyOn(hostB, 'listActiveWorkflowRuns').mockImplementation(async () => {
      const result = await realList();
      return {
        ...result,
        runs: [
          { ...result.runs[0]!, runId: 'bad-json', snapshot: '{not json' },
          {
            ...result.runs[0]!,
            runId: 'no-position',
            snapshot: { ...(result.runs[0]!.snapshot as any), activePaths: [] },
          },
          ...result.runs,
        ],
      };
    });
    const createRun = vi.spyOn(workflowB, 'createRun');
    await hostB.startWorkers();
    try {
      await hostB.restartAllActiveWorkflowRuns();
      await waitForStatus(storage, id, runId, 'success');
      expect(step2B).toHaveBeenCalledTimes(1);
      const restartedIds = createRun.mock.calls.map(([opts]) => opts?.runId);
      expect(restartedIds).not.toContain('bad-json');
      expect(restartedIds).not.toContain('no-position');
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
