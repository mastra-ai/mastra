import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryStore } from '../../mock';
import { InMemoryDB } from '../inmemory-db';
import type { CreateSavedViewInput } from './base';
import { InMemorySavedViewsStorage } from './inmemory';

function viewInput(overrides: Partial<CreateSavedViewInput> = {}): CreateSavedViewInput {
  return {
    page: 'traces',
    name: 'Errors',
    authorId: 'user-1',
    state: {
      version: 1,
      timeRange: { preset: 'last-24h' },
      filter: { logic: 'and', nodes: [{ fieldId: 'status', operatorId: 'is', value: 'error' }] },
      sort: { field: 'startedAt', direction: 'desc' },
    },
    ...overrides,
  };
}

describe('InMemorySavedViewsStorage', () => {
  let storage: InMemorySavedViewsStorage;

  beforeEach(() => {
    storage = new InMemorySavedViewsStorage({ db: new InMemoryDB() });
  });

  it('creates a view with a generated id and returns it from get', async () => {
    const created = await storage.create(viewInput());

    expect(created.id).toEqual(expect.any(String));
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toEqual(created.createdAt);
    expect(await storage.get(created.id)).toEqual(created);
  });

  it('keeps a caller-supplied id and rejects a duplicate', async () => {
    await storage.create(viewInput({ id: 'view-1' }));
    await expect(storage.create(viewInput({ id: 'view-1' }))).rejects.toThrow(/already exists/);
  });

  it('stores a null author when none is given', async () => {
    const created = await storage.create(viewInput({ authorId: undefined }));
    expect(created.authorId).toBeNull();
  });

  it('returns copies so callers cannot mutate stored JSON', async () => {
    const input = viewInput();
    const created = await storage.create(input);
    (input.state.timeRange as { preset: string }).preset = 'changed';
    (created.state as Record<string, unknown>).version = 99;

    const fetched = await storage.get(created.id);
    expect(fetched?.state.timeRange).toEqual({ preset: 'last-24h' });
    expect(fetched?.state.version).toBe(1);
  });

  it('lists views for one page, oldest first by default', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      await storage.create(viewInput({ id: 'b', name: 'B' }));
      vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
      await storage.create(viewInput({ id: 'a', name: 'A' }));
      await storage.create(viewInput({ id: 'other', page: 'metrics' }));
    } finally {
      vi.useRealTimers();
    }

    const { views, pagination } = await storage.list({ page: 'traces' });
    expect(views.map(view => view.id)).toEqual(['b', 'a']);
    expect(pagination).toEqual({ total: 2, page: 0, perPage: 100, hasMore: false });

    const byName = await storage.list({ page: 'traces', orderBy: { field: 'name', direction: 'ASC' } });
    expect(byName.views.map(view => view.id)).toEqual(['a', 'b']);

    const all = await storage.list();
    expect(all.views).toHaveLength(3);
  });

  it('paginates', async () => {
    for (const id of ['1', '2', '3']) {
      await storage.create(viewInput({ id }));
    }

    const first = await storage.list({ page: 'traces', pagination: { page: 0, perPage: 2 } });
    expect(first.views).toHaveLength(2);
    expect(first.pagination).toEqual({ total: 3, page: 0, perPage: 2, hasMore: true });

    const second = await storage.list({ page: 'traces', pagination: { page: 1, perPage: 2 } });
    expect(second.views).toHaveLength(1);
    expect(second.pagination.hasMore).toBe(false);
  });

  it('rejects an unknown orderBy field', async () => {
    await expect(storage.list({ orderBy: { field: 'state' as never } })).rejects.toThrow(/Invalid orderBy field/);
  });

  it('updates only the given fields and bumps updatedAt', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const created = await storage.create(viewInput({ id: 'view-1' }));
      vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));

      const updated = await storage.update('view-1', { name: 'Renamed' });
      expect(updated?.name).toBe('Renamed');
      expect(updated?.state).toEqual(created.state);
      expect(updated?.createdAt).toEqual(created.createdAt);
      expect(updated?.updatedAt).toEqual(new Date('2026-01-02T00:00:00Z'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns null when updating a missing view', async () => {
    expect(await storage.update('missing', { name: 'x' })).toBeNull();
  });

  it('deletes a view, and deleting a missing view is a no-op', async () => {
    const created = await storage.create(viewInput());
    await storage.delete(created.id);
    expect(await storage.get(created.id)).toBeNull();
    await expect(storage.delete(created.id)).resolves.toBeUndefined();
  });

  it('clears all views', async () => {
    await storage.create(viewInput());
    await storage.dangerouslyClearAll();
    expect((await storage.list()).views).toEqual([]);
  });

  it('is registered on InMemoryStore', async () => {
    const store = new InMemoryStore();
    const savedViews = await store.getStore('savedViews');
    expect(savedViews).toBeInstanceOf(InMemorySavedViewsStorage);
  });
});
