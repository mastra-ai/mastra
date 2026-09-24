import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '@mastra/core/mastra';
import { createStep as coreCreateStep } from '@mastra/core/workflows';
import type { TaskContext } from '@renderinc/sdk/workflows';
import { init, createMemoryPersistence, RenderSubmissionUnknownError } from './index.js';
import type { RenderTransport } from './index.js';
import { updateRun, type RunRecord } from './persistence/types.js';
import { registerRenderTasks } from './worker.js';
import { getRenderTaskContext, withTaskRuntime } from './runtime-internal.js';
import { parseEnvelope, stepOutcomeSchema } from './protocol.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function record(): RunRecord {
  return {
    workflowId: 'w',
    runId: randomUUID(),
    buildId: 'v1',
    manifest: 'hash',
    revision: 0,
    status: 'pending',
    providerId: 'remote',
    input: 1,
    initialState: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
function setup(transport: RenderTransport, store = createMemoryPersistence()) {
  const h = init({ workflowSlug: 'tests', buildId: 'v1', persistence: store, transport });
  const step = h.createStep({
    id: 'step',
    inputSchema: z.number(),
    outputSchema: z.number(),
    execute: async ({ inputData }) => inputData,
  });
  const workflow = h
    .createWorkflow({ id: randomUUID(), inputSchema: z.number(), outputSchema: z.number() })
    .then(step)
    .commit();
  return { ...h, workflow, store };
}
const unusedTransport: RenderTransport = {
  async start() {
    return 'remote';
  },
  async get(id) {
    return { id, status: 'pending' };
  },
  async cancel() {},
};

describe('durable lifecycle contracts', () => {
  it.each([false, true])(
    'reconciles after completion events, including a disconnected stream: %s',
    async disconnect => {
      let complete = false;
      let events = 0;
      const h = setup({
        ...unusedTransport,
        async get(id) {
          return complete
            ? { id, status: 'succeeded', results: [{ status: 'success', input: 1, steps: {}, result: 2 }] }
            : { id, status: 'running' };
        },
        async waitForEvent() {
          events++;
          complete = true;
          if (disconnect) throw new Error('stream disconnected');
        },
      });
      const run = await h.workflow.createRun();
      await run.startAsync({ inputData: 1 });
      expect((await h.provider.wait(h.workflow.id, run.runId)).status).toBe('success');
      expect(events).toBe(1);
    },
  );

  it('marks an ambiguous submission without permitting a second root', async () => {
    let starts = 0;
    const h = setup({
      ...unusedTransport,
      async start() {
        starts++;
        throw new Error('connection lost after write');
      },
    });
    const run = await h.workflow.createRun();
    await expect(run.startAsync({ inputData: 1 })).rejects.toBeInstanceOf(RenderSubmissionUnknownError);
    expect((await h.provider.getRun(h.workflow.id, run.runId))?.status).toBe('submission-unknown');
    await expect(run.startAsync({ inputData: 1 })).rejects.toThrow('already exists');
    expect(starts).toBe(1);
  });

  it('reports an accepted but unpersisted binding as ambiguous', async () => {
    const store = createMemoryPersistence();
    store.compareAndSwap = async () => {
      throw new Error('database unavailable');
    };
    let starts = 0;
    const h = setup(
      {
        ...unusedTransport,
        async start() {
          starts++;
          return 'accepted';
        },
      },
      store,
    );
    const run = await h.workflow.createRun();
    await expect(run.startAsync({ inputData: 1 })).rejects.toBeInstanceOf(RenderSubmissionUnknownError);
    await expect(run.startAsync({ inputData: 1 })).rejects.toThrow('already exists');
    expect(starts).toBe(1);
  });

  it('preserves completion when cancellation races it', async () => {
    let completed = false;
    const h = setup({
      ...unusedTransport,
      async get(id) {
        return completed
          ? { id, status: 'completed', results: [{ status: 'success', input: 1, steps: {}, result: 2 }] }
          : { id, status: 'running' };
      },
      async cancel() {
        completed = true;
        throw new Error('already completed');
      },
    });
    const run = await h.workflow.createRun();
    await run.startAsync({ inputData: 1 });
    await h.provider.cancel(h.workflow.id, run.runId);
    expect((await h.provider.getRun(h.workflow.id, run.runId))?.status).toBe('success');
  });

  it('keeps terminal records stable and merges competing updates', async () => {
    const store = createMemoryPersistence();
    const initial = record();
    await store.create(initial);
    await Promise.all([
      updateRun(store, initial.workflowId, initial.runId, () => ({ workerClaim: 'claim' })),
      updateRun(store, initial.workflowId, initial.runId, () => ({ providerId: 'bound' })),
    ]);
    const merged = await store.get(initial.workflowId, initial.runId);
    expect(merged).toMatchObject({ workerClaim: 'claim', providerId: 'bound', revision: 2 });
    await updateRun(store, initial.workflowId, initial.runId, () => ({ status: 'success' }));
    expect((await updateRun(store, initial.workflowId, initial.runId, () => ({ status: 'running' }))).status).toBe(
      'success',
    );
  });

  it('abort only stops the local waiter', async () => {
    let canceled = false;
    const h = setup({
      ...unusedTransport,
      async cancel() {
        canceled = true;
      },
    });
    const run = await h.workflow.createRun();
    await run.startAsync({ inputData: 1 });
    const controller = new AbortController();
    controller.abort();
    await expect(h.provider.wait(h.workflow.id, run.runId, controller.signal)).rejects.toThrow();
    expect(canceled).toBe(false);
    expect((await h.provider.getRun(h.workflow.id, run.runId))?.status).toBe('pending');
  });
});

describe('capability and worker contracts', () => {
  it('keeps coordinator names distinct from a step named root and bounds long names', () => {
    const h = init({
      workflowSlug: 'tests',
      buildId: 'v1',
      persistence: createMemoryPersistence(),
      transport: unusedTransport,
    });
    const step = h.createStep({
      id: 'root',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData }) => inputData,
    });
    const workflow = h
      .createWorkflow({ id: `long-${randomUUID()}-${randomUUID()}`, inputSchema: z.number(), outputSchema: z.number() })
      .then(step)
      .commit();
    const tasks = registerRenderTasks({ mastra: new Mastra({ workflows: { workflow }, logger: false }) });
    expect(tasks.size).toBe(2);
    for (const name of tasks.keys()) expect(name.length).toBeLessThanOrEqual(63);
  });

  it('claims one coordinator when duplicate roots arrive concurrently', async () => {
    let calls = 0;
    const h = init({
      workflowSlug: 'tests',
      buildId: 'v1',
      persistence: createMemoryPersistence(),
      transport: unusedTransport,
    });
    const step = h.createStep({
      id: 'side-effect',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData }) => {
        calls++;
        await sleep(10);
        return inputData;
      },
    });
    const workflow = h
      .createWorkflow({ id: randomUUID(), inputSchema: z.number(), outputSchema: z.number() })
      .then(step)
      .commit();
    const tasks = registerRenderTasks({ mastra: new Mastra({ workflows: { workflow }, logger: false }) });
    const manifest = h.provider.workflows.get(workflow.id)!.manifest();
    const initial = { ...record(), workflowId: workflow.id, manifest: manifest.hash };
    await h.provider.store.create(initial);
    const envelope = {
      version: 1,
      workflowId: workflow.id,
      runId: initial.runId,
      buildId: 'v1',
      manifest: manifest.hash,
      input: 1,
      state: {},
      requestContext: {},
    };
    const context: TaskContext = {
      async run(definition, ...args) {
        return definition.func(context, ...args);
      },
    };
    const root = tasks.get(manifest.rootName)!;
    const results = await Promise.allSettled([root.func(context, envelope), root.func(context, envelope)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(calls).toBe(1);
  });

  it('rejects unsupported streaming and recovery methods immediately', async () => {
    const h = setup(unusedTransport);
    const run = await h.workflow.createRun();
    expect(() => run.stream({ inputData: 1 })).toThrow('streaming');
    expect(() => run.restart()).toThrow('restart');
    expect(() => run.resume({ resumeData: {} })).toThrow('resume');
  });

  it('rejects nested workflows and suspend schemas before submission', async () => {
    const h = setup(unusedTransport);
    const nested = h
      .createWorkflow({ id: randomUUID(), inputSchema: z.number(), outputSchema: z.number() })
      .then(h.workflow)
      .commit();
    await expect(nested.createRun()).rejects.toThrow('nested');
    const suspendStep = coreCreateStep({
      id: 'suspend',
      inputSchema: z.number(),
      outputSchema: z.number(),
      suspendSchema: z.object({ reason: z.string() }),
      execute: async ({ inputData }) => inputData,
    });
    const suspendFlow = h
      .createWorkflow({ id: randomUUID(), inputSchema: z.number(), outputSchema: z.number() })
      .then(suspendStep)
      .commit();
    await expect(suspendFlow.createRun()).rejects.toThrow('suspend');
  });

  it('refuses worker version skew before executing business code', async () => {
    let calls = 0;
    const h = init({
      workflowSlug: 'tests',
      buildId: 'worker-v2',
      persistence: createMemoryPersistence(),
      transport: unusedTransport,
    });
    const step = h.createStep({
      id: 'counter',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData }) => {
        calls++;
        return inputData;
      },
    });
    const workflow = h
      .createWorkflow({ id: randomUUID(), inputSchema: z.number(), outputSchema: z.number() })
      .then(step)
      .commit();
    const definitions = registerRenderTasks({ mastra: new Mastra({ workflows: { workflow }, logger: false }) });
    const manifest = h.provider.workflows.get(workflow.id)!.manifest();
    const definition = definitions.get(manifest.steps.get('counter')!.name)!;
    const context: TaskContext = {
      async run() {
        throw new Error('unexpected child');
      },
    };
    await expect(
      definition.func(context, {
        version: 1,
        workflowId: workflow.id,
        runId: randomUUID(),
        buildId: 'caller-v1',
        manifest: manifest.hash,
        input: 1,
        state: {},
        requestContext: {},
        stepKey: 'counter',
        executionKey: 'one',
        initialInput: 1,
        priorOutputs: {},
        readOnly: false,
      }),
    ).rejects.toThrow('mismatch');
    expect(calls).toBe(0);
  });

  it('counts native definitions in the Render service limit', () => {
    const h = setup(unusedTransport);
    expect(() =>
      registerRenderTasks({
        mastra: new Mastra({ workflows: { workflow: h.workflow }, logger: false }),
        nativeTasks: Array.from({ length: 499 }, (_, i) => ({ name: `native-${i}` })),
      }),
    ).toThrow('500');
  });

  it('isolates native TaskContext between concurrent executions', async () => {
    const a: TaskContext = {
      async run() {
        throw new Error('a');
      },
    };
    const b: TaskContext = {
      async run() {
        throw new Error('b');
      },
    };
    await Promise.all(
      [a, b].map((context, index) =>
        withTaskRuntime({ context, tasks: new Map() }, async () => {
          await sleep(index ? 1 : 5);
          expect(getRenderTaskContext()).toBe(context);
        }),
      ),
    );
    expect(() => getRenderTaskContext()).toThrow('outside');
  });

  it('rejects incomplete task replies', () => {
    expect(() => parseEnvelope(stepOutcomeSchema, { stateChanged: false, state: {}, requestContext: {} })).toThrow(
      'output is required',
    );
  });
});
