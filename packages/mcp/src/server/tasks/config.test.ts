import { describe, expect, it } from 'vitest';
import { SelectingMCPTaskStore } from './config';
import { InMemoryMCPTaskStore } from './in-memory-store';
import type { MCPTaskAttemptOutcome, MCPTaskStore, MCPTaskWork } from './store';

const alice = { principal: 'alice' };
const params = { ttlMs: 60_000, principal: 'alice' };
const waitForever: MCPTaskWork = attempt =>
  new Promise<MCPTaskAttemptOutcome>(resolve =>
    attempt.signal.addEventListener('abort', () => resolve({ status: 'completed', result: { content: [] } })),
  );

describe('SelectingMCPTaskStore', () => {
  it('keeps serving a task created on a choice still in flight when it chooses again, and puts new tasks in the next store', async () => {
    const first = new InMemoryMCPTaskStore();
    const second = new InMemoryMCPTaskStore();
    let choose!: (store: MCPTaskStore) => void;
    const choices = [new Promise<MCPTaskStore>(resolve => (choose = resolve)), Promise.resolve(second)];
    const store = new SelectingMCPTaskStore(() => choices.shift()!);

    const creating = store.create(params);
    store.reselect();
    choose(first);
    const early = await creating;
    store.run(early.taskId, waitForever);
    expect(first.has(early.taskId)).toBe(true);

    const later = await store.create(params);
    expect(second.has(later.taskId)).toBe(true);
    expect(await store.get(early.taskId, alice)).toMatchObject({ status: 'working' });
    expect(await store.cancel(early.taskId, alice)).toBe(true);
    expect(await first.get(early.taskId, alice)).toMatchObject({ status: 'cancelled' });
    store.close();
  });

  it('cancels the work of the in-memory stores chosen before when it closes', async () => {
    const first = new InMemoryMCPTaskStore();
    const choices = [first, new InMemoryMCPTaskStore()];
    const store = new SelectingMCPTaskStore(async () => choices.shift()!);
    const { taskId } = await store.create(params);
    store.run(taskId, waitForever);
    store.reselect();
    await store.create(params);

    let aborted = false;
    const handle = first.handle(taskId);
    handle.signal.addEventListener('abort', () => (aborted = true));
    store.close();
    expect(aborted).toBe(true);
    expect(first.has(taskId)).toBe(false);
  });
});
