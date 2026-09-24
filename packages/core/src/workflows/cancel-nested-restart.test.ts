import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from './evented';
import type { WorkflowRunState } from './types';
import { createStep } from './workflow';

// Regression coverage for https://github.com/mastra-ai/mastra/issues/24780
describe('Run.cancel after restart cascades to persisted nested runs', () => {
  const schema = z.object({});

  function buildWorkflows() {
    const suspendingStep = createStep({
      id: 'wait-for-approval',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ suspend }) => suspend({}),
    });
    const grandchild = createWorkflow({ id: 'grandchild', inputSchema: schema, outputSchema: schema })
      .then(suspendingStep)
      .commit();
    const child = createWorkflow({ id: 'child', inputSchema: schema, outputSchema: schema }).then(grandchild).commit();
    const parent = createWorkflow({ id: 'parent', inputSchema: schema, outputSchema: schema }).then(child).commit();
    return parent;
  }

  it('cancels suspended child and grandchild runs from a recreated run', async () => {
    const storage = new MockStore();
    const processA = new Mastra({ logger: false, storage, workflows: { parent: buildWorkflows() } });
    const run = await processA.getWorkflow('parent').createRun();
    const result = await run.start({ inputData: {} });
    expect(result.status).toBe('suspended');

    const store = (await storage.getStore('workflows'))!;
    const { runs } = await store.listWorkflowRuns({});
    const nested = runs.filter(r => r.workflowName !== 'parent');
    expect(nested.map(r => r.workflowName).sort()).toEqual(['child', 'grandchild']);

    // Simulate restart: fresh Mastra instance over the same storage.
    const processB = new Mastra({ logger: false, storage, workflows: { parent: buildWorkflows() } });
    const recreated = await processB.getWorkflow('parent').createRun({ runId: run.runId });
    await recreated.cancel();

    for (const r of [{ workflowName: 'parent', runId: run.runId }, ...nested]) {
      const snapshot = await store.loadWorkflowSnapshot({ workflowName: r.workflowName, runId: r.runId });
      expect(snapshot?.status, r.workflowName).toBe('canceled');
    }
  });

  it('evented engine cancels suspended nested runs from a recreated run', async () => {
    const buildEvented = () => {
      const suspendingStep = createEventedStep({
        id: 'wait-for-approval',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ suspend }) => suspend({}),
      });
      const grandchild = createEventedWorkflow({ id: 'grandchild', inputSchema: schema, outputSchema: schema })
        .then(suspendingStep)
        .commit();
      const child = createEventedWorkflow({ id: 'child', inputSchema: schema, outputSchema: schema })
        .then(grandchild)
        .commit();
      return createEventedWorkflow({ id: 'parent', inputSchema: schema, outputSchema: schema }).then(child).commit();
    };

    const storage = new MockStore();
    const store = (await storage.getStore('workflows'))!;
    const processA = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { parent: buildEvented() },
    });
    const processB = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { parent: buildEvented() },
    });
    await processA.startWorkers();
    try {
      const run = await processA.getWorkflow('parent').createRun();
      const result = await run.start({ inputData: {} });
      expect(result.status).toBe('suspended');
      await processA.stopWorkers();

      const { runs } = await store.listWorkflowRuns({});
      const nested = runs.filter(r => r.workflowName !== 'parent');
      expect(nested.map(r => r.workflowName).sort()).toEqual(['child', 'grandchild']);

      await processB.startWorkers();
      const recreated = await processB.getWorkflow('parent').createRun({ runId: run.runId });
      await recreated.cancel();

      for (const r of [{ workflowName: 'parent', runId: run.runId }, ...nested]) {
        const snap = await store.loadWorkflowSnapshot({ workflowName: r.workflowName, runId: r.runId });
        expect(snap?.status, r.workflowName).toBe('canceled');
      }
    } finally {
      await processA.stopWorkers();
      await processB.stopWorkers();
    }
  });

  it.each([
    ['default', createWorkflow, createStep],
    ['evented', createEventedWorkflow, createEventedStep],
  ] as const)('%s engine cancels suspended foreach nested runs from a recreated run', async (_, create, step) => {
    const item = z.object({ n: z.number() });
    const build = () => {
      const maybeSuspend = (step as typeof createStep)({
        id: 'maybe-suspend',
        inputSchema: item,
        outputSchema: item,
        execute: async ({ inputData, suspend }) => (inputData.n === 1 ? suspend({}) : inputData),
      });
      const child = (create as typeof createWorkflow)({ id: 'child', inputSchema: item, outputSchema: item })
        .then(maybeSuspend)
        .commit();
      return (create as typeof createWorkflow)({ id: 'parent', inputSchema: z.array(item), outputSchema: z.any() })
        .foreach(child)
        .commit();
    };

    const storage = new MockStore();
    const store = (await storage.getStore('workflows'))!;
    const processA = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { parent: build() },
    });
    const processB = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { parent: build() },
    });
    await processA.startWorkers();
    try {
      const run = await processA.getWorkflow('parent').createRun();
      const result = await run.start({ inputData: [{ n: 0 }, { n: 1 }, { n: 2 }] });
      expect(result.status).toBe('suspended');
      await processA.stopWorkers();

      const children = (await store.listWorkflowRuns({})).runs.filter(r => r.workflowName === 'child');
      const suspended = children.filter(r => (r.snapshot as WorkflowRunState).status === 'suspended');
      expect(suspended).toHaveLength(1);

      await processB.startWorkers();
      await (await processB.getWorkflow('parent').createRun({ runId: run.runId })).cancel();

      for (const child of children) {
        const before = (child.snapshot as WorkflowRunState).status;
        const after = (await store.loadWorkflowSnapshot({ workflowName: 'child', runId: child.runId }))?.status;
        expect(after).toBe(before === 'suspended' ? 'canceled' : before);
      }
    } finally {
      await processA.stopWorkers();
      await processB.stopWorkers();
    }
  });

  function snapshot(runId: string, status: WorkflowRunState['status'], context: Record<string, any> = {}) {
    return {
      runId,
      status,
      value: {},
      context: { input: {}, ...context },
      serializedStepGraph: [{ type: 'workflow', id: 'child', workflowId: 'child' }] as any,
      activePaths: [],
      activeStepsPath: {},
      suspendedPaths: {},
      resumeLabels: {},
      waitingPaths: {},
      timestamp: Date.now(),
    } as unknown as WorkflowRunState;
  }

  it.each([
    ['default', createWorkflow],
    ['evented', createEventedWorkflow],
  ] as const)('%s engine leaves terminal and unrelated runs untouched', async (_, create) => {
    const storage = new MockStore();
    const store = (await storage.getStore('workflows'))!;
    const parent = (create as typeof createWorkflow)({ id: 'parent', inputSchema: schema, outputSchema: schema })
      .then(createStep({ id: 'child', inputSchema: schema, outputSchema: schema, execute: async () => ({}) }))
      .commit();
    new Mastra({ logger: false, storage, workflows: { parent } });

    const childStep = (runIds: string[], status = 'suspended') => ({
      child: { status, payload: {}, startedAt: 1, metadata: { nestedRunId: runIds } },
    });
    await store.persistWorkflowSnapshot({
      workflowName: 'parent',
      runId: 'p1',
      snapshot: snapshot('p1', 'suspended', childStep(['c-active', 'c-done'])),
    });
    await store.persistWorkflowSnapshot({
      workflowName: 'child',
      runId: 'c-active',
      snapshot: snapshot('c-active', 'suspended'),
    });
    await store.persistWorkflowSnapshot({
      workflowName: 'child',
      runId: 'c-done',
      snapshot: snapshot('c-done', 'success'),
    });
    await store.persistWorkflowSnapshot({
      workflowName: 'child',
      runId: 'other',
      snapshot: snapshot('other', 'suspended'),
    });

    const run = await parent.createRun({ runId: 'p1' });
    await run.cancel();

    const status = async (workflowName: string, runId: string) =>
      (await store.loadWorkflowSnapshot({ workflowName, runId }))?.status;
    expect(await status('parent', 'p1')).toBe('canceled');
    expect(await status('child', 'c-active')).toBe('canceled');
    expect(await status('child', 'c-done')).toBe('success');
    expect(await status('child', 'other')).toBe('suspended');
  });

  it('does not treat completed foreach iteration output as nested run links', async () => {
    const storage = new MockStore();
    const store = (await storage.getStore('workflows'))!;
    const parent = createWorkflow({ id: 'parent', inputSchema: schema, outputSchema: schema })
      .then(createStep({ id: 'child', inputSchema: schema, outputSchema: schema, execute: async () => ({}) }))
      .commit();
    new Mastra({ logger: false, storage, workflows: { parent } });

    const forgedLink = { nestedRunId: 'other' };
    const parentSnapshot = snapshot('p1', 'suspended', {
      child: {
        status: 'suspended',
        payload: {},
        startedAt: 1,
        output: [
          // Completed iteration whose user output mimics engine link metadata.
          {
            metadata: forgedLink,
            suspendPayload: { __workflow_meta: { runId: 'other' } },
          },
          { status: 'suspended', suspendPayload: { __workflow_meta: { runId: 'c-active' } } },
        ],
      },
    });
    (parentSnapshot as any).serializedStepGraph = [
      { type: 'foreach', step: { id: 'child', type: 'workflow', workflowId: 'child' } },
    ];
    await store.persistWorkflowSnapshot({ workflowName: 'parent', runId: 'p1', snapshot: parentSnapshot });
    await store.persistWorkflowSnapshot({
      workflowName: 'child',
      runId: 'c-active',
      snapshot: snapshot('c-active', 'suspended'),
    });
    await store.persistWorkflowSnapshot({
      workflowName: 'child',
      runId: 'other',
      snapshot: snapshot('other', 'suspended'),
    });

    await (await parent.createRun({ runId: 'p1' })).cancel();

    const status = async (runId: string) =>
      (await store.loadWorkflowSnapshot({ workflowName: 'child', runId }))?.status;
    expect(await status('c-active')).toBe('canceled');
    expect(await status('other')).toBe('suspended');
  });

  it.each([
    ['running', 'canceled'],
    ['success', 'success'],
  ] as const)('retries when a descendant moves to %s before the cancel write', async (raceStatus, expected) => {
    const storage = new MockStore();
    const store = (await storage.getStore('workflows'))!;
    const parent = createWorkflow({ id: 'parent', inputSchema: schema, outputSchema: schema })
      .then(createStep({ id: 'child', inputSchema: schema, outputSchema: schema, execute: async () => ({}) }))
      .commit();
    new Mastra({ logger: false, storage, workflows: { parent } });

    await store.persistWorkflowSnapshot({
      workflowName: 'parent',
      runId: 'p1',
      snapshot: snapshot('p1', 'suspended', {
        child: { status: 'suspended', payload: {}, startedAt: 1, metadata: { nestedRunId: ['c1'] } },
      }),
    });
    await store.persistWorkflowSnapshot({ workflowName: 'child', runId: 'c1', snapshot: snapshot('c1', 'suspended') });

    // Simulate another worker changing the child's status right before the first conditional write.
    const original = store.updateWorkflowState.bind(store);
    let raced = false;
    store.updateWorkflowState = async args => {
      if (args.workflowName === 'child' && !raced) {
        raced = true;
        await original({ workflowName: 'child', runId: 'c1', opts: { status: raceStatus } });
      }
      return original(args);
    };

    await (await parent.createRun({ runId: 'p1' })).cancel();

    expect((await store.loadWorkflowSnapshot({ workflowName: 'child', runId: 'c1' }))?.status).toBe(expected);
  });
});
