/**
 * Regression for https://github.com/mastra-ai/mastra/issues/29776 (evented engine).
 *
 * A nested workflow whose `shouldPersistSnapshot` skips `running`/`pending`
 * snapshots must still behave: its `.branch()` must finish, `.foreach()` must
 * pass every iteration result to the next step, and a step suspended two levels
 * deep must resume. The evented engine coordinates those constructs through the
 * nested run's stored record, which top-level runs always write; nested runs
 * must get the same guarantee.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

const item = z.object({ n: z.number() });

/** The persistence policy from the issue: skip in-flight snapshots, persist terminals. */
const settled = ({ workflowStatus }: { workflowStatus: string }) => !['running', 'pending'].includes(workflowStatus);

const HANG = 'HANG';
const HANG_MS = 5_000;

/** Fails the test with a clear message instead of timing the whole suite out. */
async function guarded<T>(promise: Promise<T>): Promise<T | typeof HANG> {
  return Promise.race([
    promise,
    new Promise<typeof HANG>(resolve => {
      const timer = setTimeout(() => resolve(HANG), HANG_MS);
      (timer as any).unref?.();
    }),
  ]);
}

async function withHost(
  storage: MockStore,
  workflows: Record<string, ReturnType<typeof createWorkflow>>,
  fn: () => Promise<void>,
) {
  const mastra = new Mastra({ logger: false, storage, pubsub: new EventEmitterPubSub(), workflows: workflows as any });
  await mastra.startWorkers();
  try {
    await fn();
  } finally {
    await mastra.stopWorkers();
  }
}

function makeBranchSteps() {
  const double = createStep({
    id: 'double',
    inputSchema: item,
    outputSchema: item,
    execute: async ({ inputData }) => ({ n: inputData.n * 2 }),
  });
  const other = createStep({
    id: 'other',
    inputSchema: item,
    outputSchema: item,
    execute: async ({ inputData }) => inputData,
  });
  const pick = createStep({
    id: 'pick',
    inputSchema: z.any(),
    outputSchema: item,
    execute: async ({ inputData }) => inputData.double ?? inputData.other,
  });
  return { double, other, pick };
}

function makeForeachSteps() {
  const fan = createStep({
    id: 'fan',
    inputSchema: item,
    outputSchema: z.array(item),
    execute: async ({ inputData }) => Array.from({ length: inputData.n }, () => ({ n: 1 })),
  });
  const two = createStep({
    id: 'two',
    inputSchema: item,
    outputSchema: item,
    execute: async () => ({ n: 2 }),
  });
  const sum = createStep({
    id: 'sum',
    inputSchema: z.array(item),
    outputSchema: item,
    execute: async ({ inputData }) => ({ n: inputData.reduce((total, entry) => total + entry.n, 0) }),
  });
  return { fan, two, sum };
}

function makeAsk() {
  return createStep({
    id: 'ask',
    inputSchema: item,
    outputSchema: item,
    resumeSchema: z.any(),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (resumeData === undefined) return suspend({});
      return { n: inputData.n + resumeData.value };
    },
  });
}

describe('evented nested workflow with shouldPersistSnapshot skipping running snapshots (issue #29776)', () => {
  it('finishes a nested .branch() instead of hanging', async () => {
    const { double, other, pick } = makeBranchSteps();
    const mid = createWorkflow({
      id: 'mid',
      inputSchema: item,
      outputSchema: item,
      options: { shouldPersistSnapshot: settled },
    })
      .branch([
        [async () => true, double],
        [async () => false, other],
      ])
      .then(pick)
      .commit();
    const top = createWorkflow({ id: 'top', inputSchema: item, outputSchema: item }).then(mid).commit();

    await withHost(new MockStore(), { top, mid }, async () => {
      const run = await top.createRun();
      const result = await guarded(run.start({ inputData: { n: 2 } }));

      expect(result).not.toBe(HANG);
      if (result === HANG) return;
      expect(result.status).toBe('success');
      expect((result as any).result).toEqual({ n: 4 });
    });
  });

  it('passes every .foreach() iteration result to the next step', async () => {
    const { fan, two, sum } = makeForeachSteps();
    const mid = createWorkflow({
      id: 'mid',
      inputSchema: item,
      outputSchema: item,
      options: { shouldPersistSnapshot: settled },
    })
      .then(fan)
      .foreach(two)
      .then(sum)
      .commit();
    const top = createWorkflow({ id: 'top', inputSchema: item, outputSchema: item }).then(mid).commit();

    await withHost(new MockStore(), { top, mid }, async () => {
      const run = await top.createRun();
      const result = await guarded(run.start({ inputData: { n: 3 } }));

      expect(result).not.toBe(HANG);
      if (result === HANG) return;
      expect(result.status).toBe('success');
      expect((result as any).result).toEqual({ n: 6 });
    });
  });

  it('resumes a step suspended two levels deep and keeps the nested run resource id', async () => {
    const ask = makeAsk();
    const deep = createWorkflow({
      id: 'deep',
      inputSchema: item,
      outputSchema: item,
      options: { shouldPersistSnapshot: settled },
    })
      .then(ask)
      .commit();
    const mid = createWorkflow({
      id: 'mid',
      inputSchema: item,
      outputSchema: item,
      options: { shouldPersistSnapshot: settled },
    })
      .then(deep)
      .commit();
    const top = createWorkflow({ id: 'top', inputSchema: item, outputSchema: item }).then(mid).commit();

    const storage = new MockStore();
    await withHost(storage, { top, mid, deep }, async () => {
      const run = await top.createRun({ resourceId: 'user-1' });
      const suspended: any = await guarded(run.start({ inputData: { n: 3 } }));

      expect(suspended).not.toBe(HANG);
      if (suspended === HANG) return;
      expect(suspended.status).toBe('suspended');
      expect(suspended.suspended?.[0]).toEqual(['mid', 'deep', 'ask']);

      // The nested run must be resolvable while suspended: this is the record the
      // engine needs to re-enter `mid` on resume.
      const store = (await storage.getStore('workflows'))!;
      const midRows = (await store.listWorkflowRuns({ workflowName: 'mid' })).runs;
      expect(midRows).toHaveLength(1);
      expect(midRows[0]!.resourceId).toBe('user-1');

      const resumed: any = await guarded(run.resume({ step: suspended.suspended[0], resumeData: { value: 10 } }));

      expect(resumed).not.toBe(HANG);
      if (resumed === HANG) return;
      expect(resumed.status).toBe('success');
      expect(resumed.result).toEqual({ n: 13 });
    });
  });

  it('deletes the forced nested record once a declined terminal settles', async () => {
    const onlySuspended = ({ workflowStatus }: { workflowStatus: string }) => workflowStatus === 'suspended';
    const branchSteps = makeBranchSteps();
    const foreachSteps = makeForeachSteps();

    const midBranch = createWorkflow({
      id: 'mid-branch',
      inputSchema: item,
      outputSchema: item,
      options: { shouldPersistSnapshot: onlySuspended },
    })
      .branch([
        [async () => true, branchSteps.double],
        [async () => false, branchSteps.other],
      ])
      .then(branchSteps.pick)
      .commit();
    const topBranch = createWorkflow({ id: 'top-branch', inputSchema: item, outputSchema: item })
      .then(midBranch)
      .commit();

    const midForeach = createWorkflow({
      id: 'mid-foreach',
      inputSchema: item,
      outputSchema: item,
      options: { shouldPersistSnapshot: onlySuspended },
    })
      .then(foreachSteps.fan)
      .foreach(foreachSteps.two)
      .then(foreachSteps.sum)
      .commit();
    const topForeach = createWorkflow({ id: 'top-foreach', inputSchema: item, outputSchema: item })
      .then(midForeach)
      .commit();

    const storage = new MockStore();
    await withHost(storage, { topBranch, midBranch, topForeach, midForeach }, async () => {
      const branchResult: any = await guarded((await topBranch.createRun()).start({ inputData: { n: 2 } }));
      expect(branchResult).not.toBe(HANG);
      if (branchResult === HANG) return;
      expect(branchResult.status).toBe('success');
      expect(branchResult.result).toEqual({ n: 4 });

      const foreachResult: any = await guarded((await topForeach.createRun()).start({ inputData: { n: 3 } }));
      expect(foreachResult).not.toBe(HANG);
      if (foreachResult === HANG) return;
      expect(foreachResult.status).toBe('success');
      expect(foreachResult.result).toEqual({ n: 6 });

      const store = (await storage.getStore('workflows'))!;
      expect((await store.listWorkflowRuns({ workflowName: 'mid-branch' })).runs).toHaveLength(0);
      expect((await store.listWorkflowRuns({ workflowName: 'mid-foreach' })).runs).toHaveLength(0);
    });
  });

  it('still resumes a step suspended one level deep with the same policy', async () => {
    const ask = makeAsk();
    const deep = createWorkflow({
      id: 'deep',
      inputSchema: item,
      outputSchema: item,
      options: { shouldPersistSnapshot: settled },
    })
      .then(ask)
      .commit();
    const top = createWorkflow({ id: 'top', inputSchema: item, outputSchema: item }).then(deep).commit();

    await withHost(new MockStore(), { top, deep }, async () => {
      const run = await top.createRun();
      const suspended: any = await guarded(run.start({ inputData: { n: 3 } }));

      expect(suspended).not.toBe(HANG);
      if (suspended === HANG) return;
      expect(suspended.status).toBe('suspended');
      expect(suspended.suspended?.[0]).toEqual(['deep', 'ask']);

      const resumed: any = await guarded(run.resume({ step: suspended.suspended[0], resumeData: { value: 10 } }));

      expect(resumed).not.toBe(HANG);
      if (resumed === HANG) return;
      expect(resumed.status).toBe('success');
      expect(resumed.result).toEqual({ n: 13 });
    });
  });
});
