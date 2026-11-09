/**
 * restart() on a parent whose nested workflow was mid-run must carry the nested
 * run's workflow state back to the parent, like start() and resume() do.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import type { WorkflowRunState } from './types';
import { createStep } from './workflow';

const stateSchema = z.object({ log: z.array(z.string()) });

function build(onSecond: () => Promise<void>) {
  const first = createStep({
    id: 'first',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    stateSchema,
    execute: async ({ state, setState }) => {
      await setState({ ...state, log: [...state.log, 'first'] });
      return {};
    },
  });
  const second = createStep({
    id: 'second',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    stateSchema,
    execute: async ({ state, setState }) => {
      await onSecond();
      await setState({ ...state, log: [...state.log, 'second'] });
      return {};
    },
  });
  const nested = createWorkflow({
    id: 'nested',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    stateSchema,
  })
    .then(first)
    .then(second)
    .commit();
  const readState = createStep({
    id: 'read-state',
    inputSchema: z.object({}),
    outputSchema: z.object({ log: z.array(z.string()) }),
    stateSchema,
    execute: async ({ state }) => ({ log: state.log }),
  });
  const parent = createWorkflow({
    id: 'parent',
    inputSchema: z.object({}),
    outputSchema: z.object({ log: z.array(z.string()) }),
    stateSchema,
  })
    .then(nested)
    .then(readState)
    .commit();
  return { parent, nested };
}

describe('nested workflow restart state', () => {
  it('applies the restarted nested run state to the parent', async () => {
    const storage1 = new MockStore();
    let markRunning!: () => void;
    const running = new Promise<void>(r => (markRunning = r));
    const p1 = build(async () => {
      markRunning();
      await new Promise(() => {}); // process "dies" here
    });
    new Mastra({ logger: false, storage: storage1, workflows: { parent: p1.parent, nested: p1.nested } });

    const run1 = await p1.parent.createRun();
    void run1.start({ inputData: {}, initialState: { log: [] } });
    await running;

    const store1 = (await storage1.getStore('workflows'))!;
    const storage2 = new MockStore();
    const store2 = (await storage2.getStore('workflows'))!;
    for (const name of ['parent', 'nested']) {
      const snapshot = await store1.loadWorkflowSnapshot({ workflowName: name, runId: run1.runId });
      expect(snapshot?.status).toBe('running');
      await store2.persistWorkflowSnapshot({
        workflowName: name,
        runId: run1.runId,
        snapshot: JSON.parse(JSON.stringify(snapshot)),
      });
    }

    const p2 = build(async () => {});
    new Mastra({ logger: false, storage: storage2, workflows: { parent: p2.parent, nested: p2.nested } });

    const result = await (await p2.parent.createRun({ runId: run1.runId })).restart();

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.result).toEqual({ log: ['first', 'second'] });
    }
  });

  it('keeps the parent state when the nested run restarts before its first step', async () => {
    const storage1 = new MockStore();
    const store1 = (await storage1.getStore('workflows'))!;
    let pendingNested: unknown;
    const persist = store1.persistWorkflowSnapshot.bind(store1);
    vi.spyOn(store1, 'persistWorkflowSnapshot').mockImplementation(async args => {
      if (args.workflowName === 'nested' && args.snapshot.status === 'pending') {
        pendingNested = JSON.parse(JSON.stringify(args.snapshot));
      }
      return persist(args);
    });
    let markRunning!: () => void;
    const running = new Promise<void>(r => (markRunning = r));
    const p1 = build(async () => {
      markRunning();
      await new Promise(() => {}); // process "dies" here
    });
    new Mastra({ logger: false, storage: storage1, workflows: { parent: p1.parent, nested: p1.nested } });

    const run1 = await p1.parent.createRun();
    void run1.start({ inputData: {}, initialState: { log: ['parent'] } });
    await running;

    // Recreate the crash window where the nested run only has its pending snapshot.
    const storage2 = new MockStore();
    const store2 = (await storage2.getStore('workflows'))!;
    const parentSnapshot = await store1.loadWorkflowSnapshot({ workflowName: 'parent', runId: run1.runId });
    await store2.persistWorkflowSnapshot({
      workflowName: 'parent',
      runId: run1.runId,
      snapshot: JSON.parse(JSON.stringify(parentSnapshot)),
    });
    expect(pendingNested).toBeDefined();
    await store2.persistWorkflowSnapshot({
      workflowName: 'nested',
      runId: run1.runId,
      snapshot: pendingNested as WorkflowRunState,
    });

    const p2 = build(async () => {});
    new Mastra({ logger: false, storage: storage2, workflows: { parent: p2.parent, nested: p2.nested } });

    const result = await (await p2.parent.createRun({ runId: run1.runId })).restart();

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.result).toEqual({ log: ['parent', 'first', 'second'] });
    }
  });

  it('gives each concurrent nested run its own parent state in the pending snapshot', async () => {
    const storage = new MockStore();
    const store = (await storage.getStore('workflows'))!;
    const pending: WorkflowRunState[] = [];
    const persist = store.persistWorkflowSnapshot.bind(store);
    vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async args => {
      if (args.workflowName === 'nested' && args.snapshot.status === 'pending') {
        pending.push(JSON.parse(JSON.stringify(args.snapshot)));
      }
      return persist(args);
    });
    const { parent, nested } = build(async () => {});
    new Mastra({ logger: false, storage, workflows: { parent, nested } });

    const owners = ['a', 'b', 'c', 'd'];
    const runs = await Promise.all(owners.map(() => parent.createRun()));
    await Promise.all(runs.map((run, i) => run.start({ inputData: {}, initialState: { log: [owners[i]!] } })));

    expect(pending.map(snapshot => ({ runId: snapshot.runId, log: snapshot.value.log }))).toEqual(
      expect.arrayContaining(runs.map((run, i) => ({ runId: run.runId, log: [owners[i]] }))),
    );
    expect(pending).toHaveLength(owners.length);
  });
});
