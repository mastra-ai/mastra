import { randomUUID } from 'node:crypto';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import type { IFGAProvider } from '@mastra/core/auth/ee';
import { RequestContext } from '@mastra/core/request-context';
import type { AnyWorkflow, Step } from '@mastra/core/workflows';
import type { TaskContext, TaskDefinition } from '@renderinc/sdk/workflows';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createMemoryPersistence, init, type ProviderRun, type RenderOptions, type RenderTransport } from './index.js';
import { registerRenderTasks } from './worker.js';
import { updateRun } from './persistence/types.js';

const noRetry = { maxRetries: 0, waitDurationMs: 1 };
function harness(options: Partial<RenderOptions> = {}, fga?: IFGAProvider, omitMetadata = false) {
  let definitions: ReadonlyMap<string, TaskDefinition<[unknown], unknown>>;
  const storage = new InMemoryStore();
  const nativeRuns = new Map<string, ProviderRun>();
  const calls: { name: string; id: string; parent?: string; root: string; attempt: number; input: unknown }[] = [];
  const submissions: { input: unknown; key?: string }[] = [];
  const context = (id: string, parent?: string, root = id): TaskContext => ({
    metadata: omitMetadata ? {} : { taskRunId: id, parentTaskRunId: parent, rootTaskRunId: root },
    run: (definition, ...args) => invoke(definition, randomUUID(), args, id, root),
  });
  async function invoke<A extends unknown[], R>(
    definition: TaskDefinition<A, R>,
    id: string,
    args: A,
    parent?: string,
    root = id,
  ): Promise<R> {
    let retries = 0;
    for (const binding of h.provider.workflows.values()) {
      if (binding.manifest().rootName === definition.name) retries = binding.rootPolicy.retry?.maxRetries ?? 0;
      for (const step of binding.manifest().steps.values())
        if (step.name === definition.name) retries = step.policy.retry?.maxRetries ?? 0;
    }
    for (let attempt = 0; ; attempt++) {
      nativeRuns.set(id, { id, status: 'running' });
      calls.push({ name: definition.name, id, parent, root, attempt, input: structuredClone(args[0]) });
      try {
        const result = await definition.func(context(id, parent, root), ...structuredClone(args));
        nativeRuns.set(id, { id, status: 'completed', results: [structuredClone(result)] });
        return structuredClone(result);
      } catch (error) {
        if (attempt < retries) continue;
        nativeRuns.set(id, { id, status: 'failed', error });
        throw error;
      }
    }
  }
  const transport: RenderTransport = {
    async start(slug, input, opts) {
      submissions.push({ input: structuredClone(input), key: opts?.idempotencyKey });
      const id = randomUUID();
      nativeRuns.set(id, { id, status: 'pending' });
      const definition = definitions.get(slug.split('/').at(-1)!)!;
      void Promise.resolve()
        .then(() => invoke(definition, id, [input]))
        .catch(() => {});
      return id;
    },
    async get(id) {
      return nativeRuns.get(id)!;
    },
    async cancel(id) {
      nativeRuns.set(id, { id, status: 'canceled' });
    },
  };
  const h = init({
    workflowSlug: 'native-tests',
    buildId: 'b',
    persistence: createMemoryPersistence(),
    transport,
    pollIntervalMs: 10,
    requestContextKeys: ['locale'],
    stepDefaults: { retry: noRetry },
    ...options,
  });
  return {
    ...h,
    calls,
    nativeRuns,
    submissions,
    context,
    storage,
    register(...workflows: AnyWorkflow[]) {
      definitions = registerRenderTasks({
        mastra: new Mastra({
          workflows: Object.fromEntries(workflows.map(w => [w.id, w])),
          storage,
          logger: false,
          ...(fga ? { server: { fga } } : {}),
        }),
      });
      return definitions;
    },
  };
}
const numeric = { inputSchema: z.number(), outputSchema: z.number() };

describe('native nested Mastra workflows', () => {
  it('preserves nested output, state, context, ownership and native grandchildren', async () => {
    const h = harness();
    const stateSchema = z.object({ count: z.number() });
    const leaf = h.createStep({
      id: 'leaf',
      ...numeric,
      stateSchema,
      execute: async ({ inputData, state, setState, requestContext, getInitData, resourceId, mastra }) => {
        expect(getInitData()).toBe(2);
        expect(resourceId).toBe('alice');
        expect(mastra).toBeDefined();
        expect(requestContext.get('locale')).toBe('en');
        await setState({ count: state.count + 1 });
        requestContext.set('locale', 'fr');
        return inputData * 3;
      },
    });
    const child = h
      .createWorkflow({ id: randomUUID(), ...numeric, stateSchema })
      .then(leaf)
      .commit();
    const after = h.createStep({
      id: 'after',
      ...numeric,
      stateSchema,
      execute: async ({ inputData, state, requestContext, getStepResult, getInitData }) => {
        expect(state.count).toBe(1);
        expect(getStepResult(child)).toBe(6);
        expect(getInitData()).toBe(2);
        expect(requestContext.get('locale')).toBe('fr');
        return inputData + 1;
      },
    });
    const parent = h
      .createWorkflow({ id: randomUUID(), ...numeric, stateSchema })
      .then(child)
      .then(after)
      .commit();
    expect(h.register(parent).size).toBe(4);
    const run = await parent.createRun({ resourceId: 'alice' });
    const result = await run.start({
      inputData: 2,
      initialState: { count: 0 },
      requestContext: new RequestContext([['locale', 'en']]),
    });
    expect(result, JSON.stringify(result)).toMatchObject({ status: 'success', result: 7 });
    const [root, nested, grandchild, final] = h.calls;
    expect(nested!.parent).toBe(root!.id);
    expect(grandchild!.parent).toBe(nested!.id);
    expect(final!.parent).toBe(root!.id);
    expect(new Set(h.calls.map(c => c.root))).toEqual(new Set([root!.id]));
    expect(h.submissions).toHaveLength(1);
    const snapshot = await parent.getWorkflowRunById(run.runId);
    expect(snapshot?.steps?.[`${child.id}.leaf`]).toMatchObject({ status: 'success', output: 6 });
  });

  it('keeps foreach occurrences separate and preserves order through two levels of nesting', async () => {
    const h = harness();
    const leaf = h.createStep({ id: 'same', ...numeric, execute: async ({ inputData }) => inputData + 1 });
    const child = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(leaf)
      .commit();
    const middle = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(child)
      .commit();
    const parent = h
      .createWorkflow({ id: randomUUID(), inputSchema: z.array(z.number()), outputSchema: z.array(z.number()) })
      .foreach(middle, { concurrency: 2 })
      .commit();
    expect(h.register(parent, child).size).toBe(4);
    expect(await (await parent.createRun()).start({ inputData: [3, 1] })).toMatchObject({
      status: 'success',
      result: [4, 2],
    });
    const nested = h.calls.filter(c => c.name === h.provider.workflows.get(middle.id)!.manifest().rootName);
    expect(new Set(nested.map(c => (c.input as { runId: string }).runId)).size).toBe(2);
    expect(h.calls).toHaveLength(7);
  });

  it('uses distinct nested runs for each loop iteration and workflow-scoped leaf names', async () => {
    const h = harness();
    const leaf = h.createStep({ id: 'same', ...numeric, execute: async ({ inputData }) => inputData + 1 });
    const child = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(leaf)
      .commit();
    const after = h.createStep({ id: 'same', ...numeric, execute: async ({ inputData }) => inputData * 10 });
    const parent = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .dountil(child, async ({ inputData }) => inputData === 3)
      .then(after)
      .commit();
    h.register(parent);
    expect(await (await parent.createRun()).start({ inputData: 0 })).toMatchObject({ status: 'success', result: 30 });
    const nested = h.calls.filter(c => c.name === h.provider.workflows.get(child.id)!.manifest().rootName);
    expect(new Set(nested.map(c => (c.input as { runId: string }).runId)).size).toBe(3);
    expect(h.provider.workflows.get(parent.id)!.manifest().steps.get('same')!.name).not.toBe(
      h.provider.workflows.get(child.id)!.manifest().steps.get('same')!.name,
    );
  });

  it.each(['state', 'context'])('inherits parallel mutation restrictions for %s', async mode => {
    const h = harness();
    const stateSchema = z.object({ count: z.number() });
    const leaf = h.createStep({
      id: 'mutate',
      ...numeric,
      stateSchema,
      execute: async ({ inputData, setState, requestContext }) => {
        if (mode === 'state') await setState({ count: 1 });
        else requestContext.set('locale', 'fr');
        return inputData;
      },
    });
    const child = h
      .createWorkflow({ id: randomUUID(), ...numeric, stateSchema })
      .then(leaf)
      .commit();
    const parent = h
      .createWorkflow({
        id: randomUUID(),
        inputSchema: z.array(z.number()),
        outputSchema: z.array(z.number()),
        stateSchema,
      })
      .foreach(child)
      .commit();
    h.register(parent);
    const result = await (await parent.createRun()).start({ inputData: [1], initialState: { count: 0 } });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.error.message).toContain('mutation');
  });

  it('rejects mixed providers before submitting', async () => {
    const h = harness(),
      other = harness();
    const child = other
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(other.createStep({ id: 'step', ...numeric, execute: async ({ inputData }) => inputData }))
      .commit();
    const parent = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(child)
      .commit();
    await expect(parent.createRun()).rejects.toThrow('another provider');
    expect(h.submissions).toHaveLength(0);
  });
});

describe('native coordinator retries', () => {
  it('restarts the complete graph on the same native root with fresh state and one submission', async () => {
    const h = harness({ rootTask: { retry: { maxRetries: 1, waitDurationMs: 1 } } });
    const stateSchema = z.object({ count: z.number() });
    let prepares = 0,
      attempts = 0;
    const logicalIds: string[] = [];
    const callbackIds: string[] = [];
    const prepare = h.createStep({
      id: 'prepare',
      ...numeric,
      stateSchema,
      execute: async ({ inputData, state, setState, runId }) => {
        expect(state.count).toBe(0);
        logicalIds.push(runId);
        prepares++;
        await setState({ count: 1 });
        return inputData + 1;
      },
    });
    const finish = h.createStep({
      id: 'finish',
      ...numeric,
      stateSchema,
      execute: async ({ inputData }) => {
        if (++attempts === 1) throw new Error('retry this root');
        return inputData;
      },
    });
    const workflow = h
      .createWorkflow({
        id: randomUUID(),
        ...numeric,
        stateSchema,
        options: {
          onFinish: async ({ runId }) => {
            callbackIds.push(runId);
          },
        },
      })
      .then(prepare)
      .then(finish)
      .commit();
    h.register(workflow);
    const run = await workflow.createRun();
    expect(await run.start({ inputData: 1, initialState: { count: 0 } })).toMatchObject({
      status: 'success',
      result: 2,
    });
    expect(prepares).toBe(2);
    expect(logicalIds).toEqual([run.runId, run.runId]);
    expect(callbackIds).toEqual([run.runId, run.runId]);
    expect(h.submissions).toHaveLength(1);
    expect(h.submissions[0]!.key).toMatch(/^[a-f0-9]{64}$/);
    const record = await h.provider.store.get(workflow.id, run.runId);
    expect(record!.snapshotRunId).not.toBe(run.runId);
    expect(record!.error).toBeUndefined();
    const roots = h.calls.filter(c => !c.parent);
    expect(roots).toHaveLength(2);
    expect(roots[0]!.id).toBe(roots[1]!.id);
  });

  it('does not retry roots unless opted in', async () => {
    const h = harness();
    let effects = 0;
    const workflow = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(
        h.createStep({
          id: 'fail',
          ...numeric,
          execute: async () => {
            effects++;
            throw new Error('failed');
          },
        }),
      )
      .commit();
    h.register(workflow);
    expect(await (await workflow.createRun()).start({ inputData: 1 })).toMatchObject({ status: 'failed' });
    expect(effects).toBe(1);
    expect(h.provider.workflows.get(workflow.id)!.rootPolicy.retry!.maxRetries).toBe(0);
  });

  it('keeps native retries of a nested coordinator separate from its parent', async () => {
    const h = harness();
    let effects = 0;
    const child = h
      .createWorkflow({ id: randomUUID(), ...numeric, render: { retry: { maxRetries: 1, waitDurationMs: 1 } } })
      .then(
        h.createStep({
          id: 'once',
          ...numeric,
          execute: async ({ inputData }) => {
            if (++effects === 1) throw new Error('first attempt');
            return inputData + 1;
          },
        }),
      )
      .commit();
    const parent = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(child)
      .commit();
    h.register(parent);
    expect(await (await parent.createRun()).start({ inputData: 2 })).toMatchObject({ status: 'success', result: 3 });
    expect(h.calls.filter(c => !c.parent)).toHaveLength(1);
    expect(effects).toBe(2);
  });
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
function manualHarness() {
  let envelope: unknown;
  const h = harness({
    rootTask: { retry: { maxRetries: 1, waitDurationMs: 1 } },
    transport: {
      start: async (_slug, input) => {
        envelope = input;
        return 'native-root';
      },
      get: async id => ({ id, status: 'running' }),
      cancel: async () => {},
    },
  });
  return { ...h, envelope: () => envelope };
}

describe('attempt and identity boundaries', () => {
  it('fences old attempts, isolates their snapshots and keeps the public logical run ID', async () => {
    const h = manualHarness();
    const entered = deferred(),
      release = deferred();
    let executions = 0;
    const step = h.createStep({
      id: 'slow',
      ...numeric,
      execute: async () => {
        const value = ++executions;
        if (value === 1) {
          entered.resolve();
          await release.promise;
        }
        return value;
      },
    });
    const workflow = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(step)
      .commit();
    const tasks = h.register(workflow);
    const run = await workflow.createRun();
    await run.startAsync({ inputData: 1 });
    const root = tasks.get(h.provider.workflows.get(workflow.id)!.manifest().rootName)!;
    const first = root.func(h.context('native-root'), h.envelope());
    const firstSettled = Promise.resolve(first).then(
      value => ({ value }),
      error => ({ error }),
    );
    await entered.promise;
    const firstRecord = (await h.provider.store.get(workflow.id, run.runId))!;
    const second = await root.func(h.context('native-root'), h.envelope());
    expect(second).toMatchObject({ status: 'success', result: 2, runId: run.runId });
    const current = (await h.provider.store.get(workflow.id, run.runId))!;
    expect(current.attempt).not.toBe(firstRecord.attempt);
    expect(current.snapshotRunId).not.toBe(firstRecord.snapshotRunId);
    release.resolve();
    expect(await firstSettled).toHaveProperty('error');
    expect(await h.provider.store.get(workflow.id, run.runId)).toEqual(current);
    const snapshots = (await h.storage.getStore('workflows'))!;
    const snapshot = await snapshots.loadWorkflowSnapshot({ workflowName: workflow.id, runId: current.snapshotRunId! });
    expect(snapshot).toMatchObject({ status: 'success', result: 2 });
    const visible = await workflow.getWorkflowRunById(run.runId);
    expect(visible?.runId).toBe(run.runId);
    expect(visible?.result).toBe(2);
  });

  it('rejects cancellation during a running attempt and does not start another attempt', async () => {
    const h = manualHarness();
    const entered = deferred(),
      release = deferred();
    let effects = 0;
    const workflow = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(
        h.createStep({
          id: 'cancel',
          ...numeric,
          execute: async ({ inputData }) => {
            effects++;
            entered.resolve();
            await release.promise;
            return inputData;
          },
        }),
      )
      .commit();
    const tasks = h.register(workflow);
    const run = await workflow.createRun();
    await run.startAsync({ inputData: 1 });
    const root = tasks.get(h.provider.workflows.get(workflow.id)!.manifest().rootName)!;
    const attempt = Promise.resolve(root.func(h.context('native-root'), h.envelope())).catch(error => error);
    await entered.promise;
    // Simulate cancellation near the coordinator deadline without a long unit-test wait.
    await updateRun(h.provider.store, workflow.id, run.runId, () => ({ dispatchExpiresAt: Date.now() + 80 }));
    await h.provider.cancel(workflow.id, run.runId);
    release.resolve();
    let settled = false;
    void attempt.then(() => {
      settled = true;
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(settled).toBe(false);
    expect(await attempt).toBeInstanceOf(Error);
    await expect(root.func(h.context('native-root'), h.envelope())).rejects.toThrow('terminal');
    expect((await h.provider.store.get(workflow.id, run.runId))?.status).toBe('cancel-requested');
    expect(effects).toBe(1);
  });

  it('requires native metadata and rejects a second native root before business effects', async () => {
    const h = manualHarness();
    let effects = 0;
    const workflow = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(
        h.createStep({
          id: 'effect',
          ...numeric,
          execute: async ({ inputData }) => {
            effects++;
            return inputData;
          },
        }),
      )
      .commit();
    const tasks = h.register(workflow);
    await (await workflow.createRun()).startAsync({ inputData: 1 });
    const root = tasks.get(h.provider.workflows.get(workflow.id)!.manifest().rootName)!;
    await expect(root.func({ ...h.context('native-root'), metadata: {} }, h.envelope())).rejects.toThrow('metadata');
    await expect(root.func(h.context('other-root'), h.envelope())).rejects.toThrow('another native task');
    await expect(root.func(h.context('native-root', 'some-parent'), h.envelope())).rejects.toThrow(
      'native Render root',
    );
    expect(effects).toBe(0);
  });

  it('rejects an authorized child payload replayed under a different native parent or root', async () => {
    const h = manualHarness();
    const entered = deferred(),
      release = deferred();
    let effects = 0;
    const workflow = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(
        h.createStep({
          id: 'effect',
          ...numeric,
          execute: async ({ inputData }) => {
            effects++;
            entered.resolve();
            await release.promise;
            return inputData;
          },
        }),
      )
      .commit();
    const tasks = h.register(workflow);
    await (await workflow.createRun()).startAsync({ inputData: 1 });
    const manifest = h.provider.workflows.get(workflow.id)!.manifest();
    const root = tasks.get(manifest.rootName)!;
    const result = root.func(h.context('native-root'), h.envelope());
    await entered.promise;
    const leaf = tasks.get(manifest.steps.get('effect')!.name)!;
    const input = h.calls[0]!.input;
    await expect(leaf.func(h.context('forged'), input)).rejects.toThrow('parent/root identity');
    await expect(leaf.func(h.context('forged', 'wrong-parent', 'native-root'), input)).rejects.toThrow(
      'parent/root identity',
    );
    await expect(leaf.func(h.context('forged', 'native-root', 'wrong-root'), input)).rejects.toThrow(
      'parent/root identity',
    );
    expect(effects).toBe(1);
    release.resolve();
    await result;
  });

  it('revokes nested descendants after their ancestor is superseded', async () => {
    const h = manualHarness();
    const entered = deferred(),
      release = deferred();
    let effects = 0;
    const child = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(
        h.createStep({
          id: 'leaf',
          ...numeric,
          execute: async ({ inputData }) => {
            effects++;
            entered.resolve();
            await release.promise;
            return inputData;
          },
        }),
      )
      .commit();
    const parent = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(child)
      .commit();
    const tasks = h.register(parent);
    const run = await parent.createRun();
    await run.startAsync({ inputData: 1 });
    const root = tasks.get(h.provider.workflows.get(parent.id)!.manifest().rootName)!;
    const result = Promise.resolve(root.func(h.context('native-root'), h.envelope())).catch(error => error);
    await entered.promise;
    await updateRun(h.provider.store, parent.id, run.runId, () => ({
      attempt: 'replacement',
      workerClaim: 'replacement-secret',
    }));
    const leafCall = h.calls.find(
      call => call.name === h.provider.workflows.get(child.id)!.manifest().steps.get('leaf')!.name,
    )!;
    const leaf = tasks.get(leafCall.name)!;
    await expect(leaf.func(h.context('replay', leafCall.parent, leafCall.root), leafCall.input)).rejects.toThrow(
      'superseded parent',
    );
    expect(effects).toBe(1);
    release.resolve();
    expect(await result).toBeInstanceOf(Error);
    expect((await h.provider.store.get(parent.id, run.runId))?.workerClaim).toBe('replacement-secret');
  });

  it('counts all unique nested definitions before submission', async () => {
    const h = harness();
    const children = Array.from({ length: 250 }, () =>
      h
        .createWorkflow({ id: randomUUID(), ...numeric })
        .then(h.createStep({ id: 'leaf', ...numeric, execute: async ({ inputData }) => inputData }))
        .commit(),
    );
    const parent = h
      .createWorkflow({ id: randomUUID(), inputSchema: z.number(), outputSchema: z.record(z.number()) })
      .parallel(children)
      .commit();
    await expect(parent.createRun()).rejects.toThrow('500');
    expect(h.submissions).toHaveLength(0);
  });

  it('rejects cyclic nested graphs before registration', () => {
    const h = harness();
    const leaf = h.createStep({ id: 'leaf', ...numeric, execute: async ({ inputData }) => inputData });
    const a = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(leaf)
      .commit();
    const b = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(a)
      .commit();
    a.setStepFlow([{ type: 'step', step: b as unknown as Step }]);
    expect(() => h.register(a)).toThrow('cycle');
  });
});

it('enforces Mastra nested-workflow authorization before child business effects', async () => {
  const denied = vi.fn(async () => {
    throw new Error('nested access denied');
  });
  const h = harness(
    { requestContextKeys: ['user'] },
    {
      check: async () => false,
      require: denied,
      filterAccessible: async () => [],
    },
  );
  let effects = 0;
  const child = h
    .createWorkflow({ id: randomUUID(), ...numeric })
    .then(
      h.createStep({
        id: 'private',
        ...numeric,
        execute: async ({ inputData }) => {
          effects++;
          return inputData;
        },
      }),
    )
    .commit();
  const parent = h
    .createWorkflow({ id: randomUUID(), ...numeric })
    .then(child)
    .commit();
  h.register(parent);
  const result = await (
    await parent.createRun()
  ).start({ inputData: 1, requestContext: new RequestContext<unknown>([['user', { id: 'alice' }]]) });
  expect(result.status).toBe('failed');
  if (result.status === 'failed') expect(result.error.message).toContain('nested access denied');
  expect(effects).toBe(0);
  expect(denied).toHaveBeenCalledOnce();
});

it('forwards the persisted idempotency key through the real Render SDK transport', async () => {
  const { createServer } = await import('node:http');
  const { createRenderTransport } = await import('./transport.js');
  let submitted: unknown;
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk.toString();
    submitted = JSON.parse(body);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ id: 'native-response' }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test server port');
    const transport = createRenderTransport({ useLocalDev: true, localDevUrl: `http://127.0.0.1:${address.port}` });
    expect(await transport.start('example/task:version', { input: 1 }, { idempotencyKey: 'logical-run-key' })).toBe(
      'native-response',
    );
    expect(submitted).toEqual({
      task: 'example/task:version',
      input: [{ input: 1 }],
      idempotencyKey: 'logical-run-key',
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  }
});

describe('explicit local development compatibility', () => {
  it('retains signed nested execution when the local CLI omits metadata', async () => {
    const h = harness({ client: { useLocalDev: true } }, undefined, true);
    const child = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(h.createStep({ id: 'leaf', ...numeric, execute: async ({ inputData }) => inputData + 1 }))
      .commit();
    const parent = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(child)
      .commit();
    h.register(parent);
    expect(await (await parent.createRun()).start({ inputData: 1 })).toMatchObject({ status: 'success', result: 2 });
  });

  it('rejects root retries before effects if the local CLI omits metadata', async () => {
    const h = harness(
      { client: { useLocalDev: true }, rootTask: { retry: { maxRetries: 1, waitDurationMs: 1 } } },
      undefined,
      true,
    );
    let effects = 0;
    const workflow = h
      .createWorkflow({ id: randomUUID(), ...numeric })
      .then(
        h.createStep({
          id: 'leaf',
          ...numeric,
          execute: async ({ inputData }) => {
            effects++;
            return inputData;
          },
        }),
      )
      .commit();
    h.register(workflow);
    const result = await (await workflow.createRun()).start({ inputData: 1 });
    expect(result).toMatchObject({ status: 'failed' });
    expect(
      [...h.nativeRuns.values()].some(
        run => run.error instanceof Error && run.error.message.includes('Root retries require native task metadata'),
      ),
    ).toBe(true);
    expect(effects).toBe(0);
  });
});
