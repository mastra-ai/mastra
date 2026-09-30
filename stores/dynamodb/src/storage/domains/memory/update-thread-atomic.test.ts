import { describe, expect, it, vi } from 'vitest';
import { MemoryStorageDynamoDB } from './index';

function createStore() {
  const calls: Array<{ set?: unknown; remove?: unknown }> = [];
  const update = vi.fn(() => {
    const call: { set?: unknown; remove?: unknown } = {};
    calls.push(call);
    const chain = {
      set: (data: unknown) => ((call.set = data), chain),
      remove: (attrs: unknown) => ((call.remove = attrs), chain),
      go: vi.fn(async () => ({})),
    };
    return chain;
  });
  const store = Object.create(MemoryStorageDynamoDB.prototype) as MemoryStorageDynamoDB;
  Object.assign(store, {
    service: { entities: { thread: { update } } },
    logger: { debug: vi.fn(), error: vi.fn(), trackException: vi.fn() },
  });
  vi.spyOn(store, 'getThreadById').mockResolvedValue({
    id: 't1',
    resourceId: 'r1',
    title: 'old',
    metadata: {},
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
    archivedAt: new Date('2025-01-03'),
  });
  return { store, calls };
}

describe('DynamoDB updateThread unarchive', () => {
  it('clears archivedAt and applies other changes in a single update', async () => {
    const { store, calls } = createStore();

    await store.updateThread({ id: 't1', title: 'new', archivedAt: null });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.set).toMatchObject({ title: 'new' });
    expect(calls[0]!.remove).toEqual(['archivedAt']);
  });

  it('issues a single remove-only update when only unarchiving', async () => {
    const { store, calls } = createStore();

    await store.updateThread({ id: 't1', archivedAt: null });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.remove).toEqual(['archivedAt']);
    expect(calls[0]!.set).toBeUndefined();
  });
});
