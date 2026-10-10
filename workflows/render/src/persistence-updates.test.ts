import { expect, it, vi } from 'vitest';
import { createMemoryPersistence } from './persistence/memory.js';
import { updateRun } from './persistence/types.js';
import type { RunRecord } from './persistence/types.js';
import { init } from './index.js';

async function fixture() {
  const store = createMemoryPersistence();
  const initial: RunRecord = {
    workflowId: 'workflow',
    runId: 'run',
    buildId: 'build',
    manifest: 'manifest',
    providerId: 'native',
    status: 'running',
    revision: 1,
    input: { draft: 'x'.repeat(100000) },
    initialState: {},
    createdAt: 1,
    updatedAt: 2,
  };
  await store.create(initial);
  const compare = store.compareAndSwap.bind(store);
  const write = vi.spyOn(store, 'compareAndSwap');
  return { store, initial, write, compare };
}

it('leaves revision and timestamps unchanged for repeated running status polls', async () => {
  const { store, initial, write } = await fixture();
  const { provider } = init({
    workflowSlug: 'test',
    buildId: 'build',
    persistence: store,
    transport: { start: async () => 'native', get: async id => ({ id, status: 'running' }), cancel: async () => {} },
  });
  const records = await Promise.all(Array.from({ length: 30 }, () => provider.getRun('workflow', 'run')));
  expect(records.every(record => record?.revision === initial.revision && record.updatedAt === initial.updatedAt)).toBe(
    true,
  );
  expect(write).not.toHaveBeenCalled();
  expect(await store.get('workflow', 'run')).toEqual(initial);
});

it('skips empty and structurally equal patches regardless of object key order', async () => {
  const { store, write } = await fixture();
  await updateRun(store, 'workflow', 'run', () => ({ error: { name: 'Error', message: 'same' } }));
  write.mockClear();
  const before = await store.get('workflow', 'run');
  await updateRun(store, 'workflow', 'run', () => ({}));
  await updateRun(store, 'workflow', 'run', () => ({
    error: { message: 'same', name: 'Error' },
    resourceId: undefined,
  }));
  expect(write).not.toHaveBeenCalled();
  expect(await store.get('workflow', 'run')).toEqual(before);
});

it('persists real changes, including clearing an optional field, and protects terminal records', async () => {
  const { store, write } = await fixture();
  await updateRun(store, 'workflow', 'run', () => ({ error: { name: 'Error', message: 'old' } }));
  await updateRun(store, 'workflow', 'run', () => ({ error: undefined }));
  const completed = await updateRun(store, 'workflow', 'run', () => ({
    status: 'success',
    result: { answer: 42 },
    dispatchClosed: true,
  }));
  expect(completed.revision).toBe(4);
  expect(completed.error).toBeUndefined();
  expect(completed.updatedAt).toBeGreaterThan(2);
  expect(await updateRun(store, 'workflow', 'run', () => ({ status: 'running', dispatchClosed: false }))).toEqual(
    completed,
  );
  expect(write).toHaveBeenCalledTimes(3);
});

it('recomputes a lost CAS against the latest cancellation and avoids a redundant retry write', async () => {
  const { store, initial, write, compare } = await fixture();
  write.mockImplementationOnce(async () => {
    await compare({ ...initial, revision: 2, status: 'cancel-requested', updatedAt: 3 }, 1);
    return false;
  });
  const result = await updateRun(store, 'workflow', 'run', current => ({
    status: current.status === 'cancel-requested' ? current.status : 'pending',
  }));
  expect(result.status).toBe('cancel-requested');
  expect(result.revision).toBe(2);
  expect(write).toHaveBeenCalledTimes(1);
});

it('preserves callback validation even when no write would be necessary', async () => {
  const { store, write } = await fixture();
  await expect(
    updateRun(store, 'workflow', 'run', () => {
      throw new Error('invalid claim');
    }),
  ).rejects.toThrow('invalid claim');
  expect(write).not.toHaveBeenCalled();
});
