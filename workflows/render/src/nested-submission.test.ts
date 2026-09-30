import { randomUUID } from 'node:crypto';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import type { TaskContext } from '@renderinc/sdk/workflows';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createMemoryPersistence, init, RenderSubmissionUnknownError } from './index.js';
import { assertDispatchOpen, authorizeDispatch } from './authorization.js';
import { executeNested } from './nested.js';
import { identity } from './native.js';
import { updateRun, type RunRecord } from './persistence/types.js';
import { withTaskRuntime } from './runtime-internal.js';
import { registerRenderTasks } from './worker.js';

/** Exercise the real nested dispatcher and coordinator with controlled native acceptance and persistence races. */
async function fixture() {
  const store = createMemoryPersistence();
  const remote = vi.fn(async (id: string) => ({ id, status: 'running' }));
  const adapter = init({
    workflowSlug: 'test',
    buildId: 'test',
    persistence: store,
    pollIntervalMs: 10,
    transport: { start: async () => 'unused', get: remote, cancel: async () => {} },
  });
  const effect = vi.fn(async ({ inputData }: { inputData: number }) => inputData + 1);
  const workflow = adapter
    .createWorkflow({ id: randomUUID(), inputSchema: z.number(), outputSchema: z.number() })
    .then(adapter.createStep({ id: 'leaf', inputSchema: z.number(), outputSchema: z.number(), execute: effect }))
    .commit();
  const tasks = registerRenderTasks({
    mastra: new Mastra({ workflows: { workflow }, storage: new InMemoryStore(), logger: false }),
  });
  const binding = adapter.provider.workflows.get(workflow.id)!;
  const parent: RunRecord = {
    workflowId: 'parent',
    runId: randomUUID(),
    buildId: 'test',
    manifest: 'parent',
    revision: 0,
    status: 'running',
    workerClaim: 'secret',
    attempt: 'attempt',
    providerId: 'native-parent',
    rootProviderId: 'native-parent',
    dispatchClosed: false,
    dispatchExpiresAt: Date.now() + 60000,
    input: 1,
    initialState: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await store.create(parent);
  const runId = identity(parent.runId, parent.attempt, workflow.id, 'one');
  const dispatch = vi.fn<TaskContext['run']>(async () => {
    throw new Error('dispatch response lost');
  });
  const assertActive = vi.fn(async () => assertDispatchOpen((await store.get(parent.workflowId, parent.runId))!));
  const invoke = () =>
    withTaskRuntime(
      {
        context: { metadata: {}, run: dispatch as TaskContext['run'] },
        tasks,
        run: parent,
        attempt: parent.attempt,
        assertActive,
        authorize: envelope => authorizeDispatch(envelope, parent.workerClaim!),
      },
      () => executeNested(binding, { input: 1, state: {}, requestContext: {}, readOnly: false, executionKey: 'one' }),
    );
  const read = () => store.get(workflow.id, runId);
  const patchParent = (patch: Partial<RunRecord>) => updateRun(store, parent.workflowId, parent.runId, () => patch);
  const reserve = () =>
    store.create({
      ...parent,
      workflowId: workflow.id,
      runId,
      status: 'pending',
      providerId: undefined,
      workerClaim: undefined,
      attempt: undefined,
      rootProviderId: undefined,
      dispatchClosed: undefined,
      parent: { workflowId: parent.workflowId, runId: parent.runId, attempt: parent.attempt! },
    });
  const wait = () => adapter.provider.wait(workflow.id, runId, AbortSignal.timeout(100));
  return {
    adapter,
    store,
    parent,
    runId,
    workflow,
    tasks,
    binding,
    effect,
    dispatch,
    assertActive,
    invoke,
    read,
    patchParent,
    reserve,
    wait,
    remote,
  };
}

describe('nested submission outcomes', () => {
  it('records uncertainty after calling native dispatch and never repeats the submission', async () => {
    const h = await fixture();
    await expect(h.invoke()).rejects.toThrow('dispatch response lost');
    expect(await h.read()).toMatchObject({
      status: 'submission-unknown',
      error: { message: 'dispatch response lost' },
    });
    await expect(h.wait()).rejects.toBeInstanceOf(RenderSubmissionUnknownError);
    await expect(h.invoke()).rejects.toThrow('already reserved');
    expect(h.dispatch).toHaveBeenCalledOnce();
    expect(h.remote).not.toHaveBeenCalled();
  });

  it('records a known failure when a queued dispatch is rejected before reaching Render', async () => {
    const h = await fixture();
    h.assertActive.mockResolvedValueOnce().mockRejectedValueOnce(new Error('parent closed while queued'));
    await expect(h.invoke()).rejects.toThrow('parent closed while queued');
    expect(await h.read()).toMatchObject({ status: 'failed', dispatchClosed: true });
    expect((await h.wait()).status).toBe('failed');
    expect(h.dispatch).not.toHaveBeenCalled();
  });

  it.each(['running', 'cancel-requested', 'success', 'failed', 'canceled'] as const)(
    'preserves a child that has already claimed or reached %s',
    async status => {
      const h = await fixture();
      h.dispatch.mockImplementationOnce(async () => {
        await updateRun(h.store, h.workflow.id, h.runId, () => ({
          status,
          workerClaim: 'child',
          providerId: 'native-child',
          error: { name: 'Original', message: 'child outcome' },
          snapshotRunId: 'snapshot',
        }));
        throw new Error('result channel lost');
      });
      await expect(h.invoke()).rejects.toMatchObject({ snapshotRunId: 'snapshot' });
      expect(await h.read()).toMatchObject({ status, providerId: 'native-child', error: { message: 'child outcome' } });
    },
  );

  it('preserves a claim that wins the compare-and-swap race with uncertainty', async () => {
    const h = await fixture();
    const cas = h.store.compareAndSwap.bind(h.store);
    vi.spyOn(h.store, 'compareAndSwap').mockImplementationOnce(async (record, revision) => {
      await cas(
        { ...record, status: 'running', providerId: 'native-child', workerClaim: 'child', error: undefined },
        revision,
      );
      return false;
    });
    await expect(h.invoke()).rejects.toThrow('dispatch response lost');
    expect(await h.read()).toMatchObject({ status: 'running', providerId: 'native-child', workerClaim: 'child' });
  });

  it.each([false, true])(
    'allows an accepted late child only while its parent remains active: closed=%s',
    async closed => {
      const h = await fixture();
      let accepted: unknown;
      h.dispatch.mockImplementationOnce(async (_definition, ...args) => {
        accepted = args[0];
        throw new Error('lost response');
      });
      await expect(h.invoke()).rejects.toThrow('lost response');
      expect((await h.read())?.status).toBe('submission-unknown');
      if (closed) await h.patchParent({ dispatchClosed: true });
      const context = (id: string, parent: string): TaskContext => ({
        metadata: { taskRunId: id, parentTaskRunId: parent, rootTaskRunId: 'native-parent' },
        run: (definition, ...args) => Promise.resolve(definition.func(context('native-leaf', id), ...args)),
      });
      const execute = () =>
        Promise.resolve(
          h.tasks.get(h.binding.manifest().rootName)!.func(context('native-child', 'native-parent'), accepted),
        );
      if (closed) {
        await expect(execute()).rejects.toThrow('no longer accepting');
        expect(h.effect).not.toHaveBeenCalled();
        expect((await h.read())?.status).toBe('submission-unknown');
      } else {
        await expect(execute()).resolves.toMatchObject({ result: { status: 'success', result: 2 } });
        expect(h.effect).toHaveBeenCalledOnce();
        expect(await h.read()).toMatchObject({ providerId: 'native-child', status: 'running', error: undefined });
      }
    },
  );

  it('recovers the uncertainty record on lookup if error bookkeeping failed', async () => {
    const h = await fixture();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cas = vi.spyOn(h.store, 'compareAndSwap').mockRejectedValueOnce(new Error('database temporarily down'));
    try {
      await expect(h.invoke()).rejects.toThrow('dispatch response lost');
      expect(log).toHaveBeenCalled();
      cas.mockRestore();
      await h.patchParent({ dispatchClosed: true });
      await expect(h.wait()).rejects.toBeInstanceOf(RenderSubmissionUnknownError);
    } finally {
      log.mockRestore();
      cas.mockRestore();
    }
  });
});

describe('unbound nested reconciliation after parent loss', () => {
  it('reconciles a reservation committed just before its create response was lost', async () => {
    const h = await fixture();
    const create = h.store.create.bind(h.store);
    vi.spyOn(h.store, 'create').mockImplementationOnce(async record => {
      await create(record);
      throw new Error('reservation response lost');
    });
    await expect(h.invoke()).rejects.toThrow('reservation response lost');
    expect(h.dispatch).not.toHaveBeenCalled();
    await h.patchParent({ dispatchClosed: true });
    await expect(h.wait()).rejects.toBeInstanceOf(RenderSubmissionUnknownError);
  });

  it('detects a missing higher ancestor without requiring native API access', async () => {
    const h = await fixture();
    await h.reserve();
    await h.patchParent({ parent: { workflowId: 'missing', runId: 'missing', attempt: 'old' } });
    await expect(h.wait()).rejects.toBeInstanceOf(RenderSubmissionUnknownError);
    expect(h.remote).not.toHaveBeenCalled();
  });

  it('preserves a concurrent native binding during orphan reconciliation', async () => {
    const h = await fixture();
    await h.reserve();
    await h.patchParent({ dispatchClosed: true });
    const cas = h.store.compareAndSwap.bind(h.store);
    vi.spyOn(h.store, 'compareAndSwap').mockImplementationOnce(async (record, revision) => {
      await cas(
        { ...record, status: 'running', providerId: 'accepted', workerClaim: 'child', error: undefined },
        revision,
      );
      return false;
    });
    expect(await h.adapter.provider.getRun(h.workflow.id, h.runId)).toMatchObject({
      status: 'running',
      providerId: 'accepted',
    });
    expect((await h.read())?.error).toBeUndefined();
  });

  it.each([
    { status: 'failed' as const },
    { status: 'success' as const },
    { status: 'canceled' as const },
    { status: 'cancel-requested' as const },
    { dispatchClosed: true },
    { dispatchExpiresAt: Date.now() - 1000 },
    { attempt: 'next-attempt' },
  ])('reports uncertainty instead of waiting forever when parent changes: %j', async patch => {
    const h = await fixture();
    await h.reserve();
    await h.patchParent(patch);
    await expect(h.wait()).rejects.toBeInstanceOf(RenderSubmissionUnknownError);
    expect(await h.read()).toMatchObject({ status: 'submission-unknown' });
    expect(h.remote).not.toHaveBeenCalled();
  });

  it('retains pending status while the parent can still dispatch the child', async () => {
    const h = await fixture();
    await h.reserve();
    expect((await h.adapter.provider.getRun(h.workflow.id, h.runId))?.status).toBe('pending');
  });

  it('does not turn database lookup failures into claimed submission outcomes', async () => {
    const h = await fixture();
    await h.reserve();
    const get = h.store.get.bind(h.store);
    vi.spyOn(h.store, 'get').mockImplementation((workflow, run) =>
      workflow === 'parent' ? Promise.reject(new Error('database unavailable')) : get(workflow, run),
    );
    await expect(h.adapter.provider.getRun(h.workflow.id, h.runId)).rejects.toThrow('database unavailable');
    expect((await get(h.workflow.id, h.runId))?.status).toBe('pending');
  });
});
