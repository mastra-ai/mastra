import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { DefaultExecutionEngine } from './default';
import { createWorkflow as createEventedWorkflow } from './evented';
import { createStep } from './workflow';

function gateStep() {
  return createStep({
    id: 'gate',
    inputSchema: z.object({}),
    outputSchema: z.object({ approved: z.boolean() }),
    resumeSchema: z.boolean(),
    execute: async ({ resumeData, suspend }) => {
      if (resumeData === undefined) return suspend({});
      return { approved: resumeData };
    },
  });
}

function gateWorkflow(storageVersion?: 1 | 2) {
  return createWorkflow({
    id: 'gated',
    inputSchema: z.object({}),
    outputSchema: z.object({ approved: z.boolean() }),
    options: { storageVersion },
  })
    .then(gateStep())
    .commit();
}

function host(storage: InstanceType<typeof MockStore>, workflow: ReturnType<typeof gateWorkflow>) {
  return new Mastra({ logger: false, storage, workflows: { gated: workflow } });
}

describe('storageVersion guards', () => {
  it('rejects storageVersion: 2 together with pruneSnapshot at construction', () => {
    expect(() =>
      createWorkflow({
        id: 'pruned',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        options: { storageVersion: 2, pruneSnapshot: ({ snapshot }) => snapshot },
      }),
    ).toThrow(/storageVersion: 2 and pruneSnapshot/);
  });

  it('rejects storageVersion: 2 on the evented engine at registration', () => {
    const workflow = createEventedWorkflow({
      id: 'evented-v2',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { storageVersion: 2 },
    })
      .then(createStep({ id: 's', inputSchema: z.object({}), outputSchema: z.object({}), execute: async () => ({}) }))
      .commit();

    expect(() => new Mastra({ logger: false, storage: new MockStore(), workflows: { workflow } })).toThrow(
      /evented engine doesn't support yet/,
    );
  });

  it('rejects storageVersion: 2 at createRun when the store has no journal support', async () => {
    const storage = new MockStore();
    const workflow = gateWorkflow(2);
    host(storage, workflow);
    const store = (await storage.getStore('workflows'))!;
    vi.spyOn(store, 'supportsRunJournal').mockReturnValue(false);

    await expect(workflow.createRun()).rejects.toThrow(/storage adapter doesn't support yet/);
  });

  it('fails a storageVersion: 2 workflow nested in an evented parent instead of storing it as v1', async () => {
    const nested = createWorkflow({
      id: 'nested-v2',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { storageVersion: 2 },
    })
      .then(
        createStep({ id: 'inner', inputSchema: z.object({}), outputSchema: z.object({}), execute: async () => ({}) }),
      )
      .commit();
    const parent = createEventedWorkflow({
      id: 'evented-parent',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    })
      .then(nested)
      .commit();

    const storage = new MockStore();
    const mastra = new Mastra({ logger: false, storage, pubsub: new EventEmitterPubSub(), workflows: { parent } });
    await mastra.startWorkers();
    try {
      const run = await parent.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('failed');
      expect((result as any).error.code).toBe('WORKFLOW_STORAGE_V2_UNSUPPORTED_ENGINE');
      expect((result as any).steps['nested-v2'].status).toBe('failed');
    } finally {
      await mastra.stopWorkers();
    }
  });
});

describe('storageVersion per run', () => {
  it('takes the version from the workflow definition', async () => {
    const storage = new MockStore();
    const v1 = gateWorkflow();
    host(storage, v1);
    const v1Run = await v1.createRun();
    expect(v1Run.storageVersion).toBe(1);

    const v2 = gateWorkflow(2);
    host(storage, v2);
    const v2Run = await v2.createRun();
    expect(v2Run.storageVersion).toBe(2);

    const store = (await storage.getStore('workflows'))!;
    expect((await store.getWorkflowRunById({ runId: v1Run.runId, workflowName: 'gated' }))?.storageVersion).toBe(
      undefined,
    );
    expect((await store.getWorkflowRunById({ runId: v2Run.runId, workflowName: 'gated' }))?.storageVersion).toBe(2);
  });

  it('passes the run version to the execution engine', async () => {
    const storage = new MockStore();
    const workflow = gateWorkflow();
    host(storage, workflow);
    const execute = vi.spyOn(DefaultExecutionEngine.prototype, 'execute');

    const run = await workflow.createRun();
    await run.start({ inputData: {} });

    expect(execute.mock.calls[0]![0].storageVersion).toBe(1);
    execute.mockRestore();
  });

  it('refuses to continue a v1 run through a v2 definition and leaves it untouched', async () => {
    const storage = new MockStore();
    const v1 = gateWorkflow(1);
    host(storage, v1);
    const run = await v1.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const store = (await storage.getStore('workflows'))!;
    const before = structuredClone(await store.loadWorkflowSnapshot({ workflowName: 'gated', runId: run.runId }));

    const v2 = gateWorkflow(2);
    host(storage, v2);
    await expect(v2.createRun({ runId: run.runId })).rejects.toThrow(
      /was created with storageVersion: 1, but the workflow now sets storageVersion: 2/,
    );

    expect(await store.loadWorkflowSnapshot({ workflowName: 'gated', runId: run.runId, storageVersion: 2 })).toBeNull();
    expect(await store.loadWorkflowSnapshot({ workflowName: 'gated', runId: run.runId })).toEqual(before);

    // The rejected run isn't cached, so the original definition can still resume it.
    const resumed = await (await v1.createRun({ runId: run.runId })).resume({ step: 'gate', resumeData: true });
    expect(resumed.status).toBe('success');
  });

  it('refuses to continue a v2 run through a v1 definition', async () => {
    const storage = new MockStore();
    const v2 = gateWorkflow(2);
    host(storage, v2);
    const run = await v2.createRun();

    const v1 = gateWorkflow(1);
    host(storage, v1);
    await expect(v1.createRun({ runId: run.runId })).rejects.toThrow(
      /was created with storageVersion: 2, but the workflow now sets storageVersion: 1/,
    );

    const store = (await storage.getStore('workflows'))!;
    expect(await store.loadWorkflowSnapshot({ workflowName: 'gated', runId: run.runId, storageVersion: 1 })).toBeNull();
  });
});
