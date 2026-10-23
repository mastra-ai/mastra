import type { CreateSavedViewInput, MastraStorage, SavedViewsStorage } from '@mastra/core/storage';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

export interface SavedViewsTestOptions {
  storage: MastraStorage;
}

function viewInput(overrides: Partial<CreateSavedViewInput> = {}): CreateSavedViewInput {
  return {
    page: 'traces',
    name: 'Errors',
    authorId: 'user-1',
    state: {
      version: 1,
      timeRange: { preset: 'last-24h' },
      filter: {
        logic: 'and',
        nodes: [
          { fieldId: 'status', operatorId: 'is', value: 'error' },
          {
            kind: 'group',
            logic: 'or',
            nodes: [
              { fieldId: 'entityName', operatorId: 'is', value: 'weather-agent' },
              { fieldId: 'durationMs', operatorId: 'gt', value: 1500 },
            ],
          },
        ],
      },
      sort: { field: 'startedAt', direction: 'desc' },
      columns: { visibleColumns: ['status', 'duration'], customColumns: [], metadataKeys: ['tier'] },
      columnOrder: ['startTime', 'type', 'metadata:tier'],
    },
    ...overrides,
  };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function createSavedViewsTests({ storage }: SavedViewsTestOptions) {
  // Optional domain: stores that have not implemented it skip rather than fail.
  const describeSavedViews = storage.stores?.savedViews ? describe : describe.skip;

  describeSavedViews('savedViews', () => {
    let store: SavedViewsStorage;

    beforeAll(async () => {
      const s = await storage.getStore('savedViews');
      if (!s) {
        throw new Error('SavedViews storage not found');
      }
      store = s;
    });

    beforeEach(async () => {
      await store.dangerouslyClearAll();
    });

    it('returns null for a missing view', async () => {
      expect(await store.get('missing')).toBeNull();
    });

    it('creates a view and reads it back', async () => {
      const created = await store.create(viewInput());
      expect(created.id).toEqual(expect.any(String));
      expect(created.page).toBe('traces');
      expect(created.name).toBe('Errors');
      expect(created.authorId).toBe('user-1');
      expect(created.updatedById).toBe('user-1');
      expect(created.resourceId).toBeNull();
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);

      const fetched = await store.get(created.id);
      expect(fetched).toEqual(created);
    });

    it('keeps a caller-supplied id and rejects a duplicate', async () => {
      const created = await store.create(viewInput({ id: 'view-1' }));
      expect(created.id).toBe('view-1');
      await expect(store.create(viewInput({ id: 'view-1', name: 'Other' }))).rejects.toThrow();
      expect((await store.get('view-1'))?.name).toBe('Errors');
    });

    it('stores a null author when none is given', async () => {
      const created = await store.create(viewInput({ authorId: undefined }));
      expect(created.authorId).toBeNull();
      expect(created.updatedById).toBeNull();
      expect(await store.get(created.id)).toMatchObject({ authorId: null, updatedById: null });

      const explicitNull = await store.create(viewInput({ authorId: null }));
      expect((await store.get(explicitNull.id))?.authorId).toBeNull();
    });

    it('round-trips nested state JSON unchanged', async () => {
      const input = viewInput();
      const created = await store.create(input);
      const fetched = await store.get(created.id);
      expect(fetched?.state).toEqual(input.state);
    });

    it('lists views for one page, oldest first by default', async () => {
      await store.create(viewInput({ id: 'b', name: 'Bravo' }));
      await sleep(10);
      await store.create(viewInput({ id: 'a', name: 'Alpha' }));
      await store.create(viewInput({ id: 'other', name: 'Charlie', page: 'metrics' }));

      const { views, pagination } = await store.list({ page: 'traces' });
      expect(views.map(view => view.id)).toEqual(['b', 'a']);
      expect(pagination).toEqual({ total: 2, page: 0, perPage: 100, hasMore: false });

      const newestFirst = await store.list({ page: 'traces', orderBy: { field: 'createdAt', direction: 'DESC' } });
      expect(newestFirst.views.map(view => view.id)).toEqual(['a', 'b']);

      const byName = await store.list({ page: 'traces', orderBy: { field: 'name', direction: 'ASC' } });
      expect(byName.views.map(view => view.id)).toEqual(['a', 'b']);

      const all = await store.list();
      expect(all.views.map(view => view.id).sort()).toEqual(['a', 'b', 'other']);
      expect(all.pagination.total).toBe(3);
    });

    it('paginates', async () => {
      for (const id of ['view-1', 'view-2', 'view-3']) {
        await store.create(viewInput({ id }));
      }

      const first = await store.list({ page: 'traces', pagination: { page: 0, perPage: 2 } });
      expect(first.views).toHaveLength(2);
      expect(first.pagination).toEqual({ total: 3, page: 0, perPage: 2, hasMore: true });

      const second = await store.list({ page: 'traces', pagination: { page: 1, perPage: 2 } });
      expect(second.views).toHaveLength(1);
      expect(second.pagination).toEqual({ total: 3, page: 1, perPage: 2, hasMore: false });

      const ids = [...first.views, ...second.views].map(view => view.id);
      expect(new Set(ids).size).toBe(3);

      const everything = await store.list({ page: 'traces', pagination: { page: 0, perPage: false } });
      expect(everything.views).toHaveLength(3);
      expect(everything.pagination).toEqual({ total: 3, page: 0, perPage: false, hasMore: false });
    });

    it('returns an empty page for a page with no views', async () => {
      await store.create(viewInput());
      const { views, pagination } = await store.list({ page: 'metrics' });
      expect(views).toEqual([]);
      expect(pagination).toEqual({ total: 0, page: 0, perPage: 100, hasMore: false });
    });

    it('filters by resourceId', async () => {
      await store.create(viewInput({ id: 'a-traces', resourceId: 'team-a' }));
      await store.create(viewInput({ id: 'a-metrics', resourceId: 'team-a', page: 'metrics' }));
      await store.create(viewInput({ id: 'b-traces', resourceId: 'team-b' }));
      await store.create(viewInput({ id: 'unscoped' }));

      expect((await store.get('a-traces'))?.resourceId).toBe('team-a');
      expect((await store.get('unscoped'))?.resourceId).toBeNull();

      const teamA = await store.list({ resourceId: 'team-a' });
      expect(teamA.views.map(view => view.id).sort()).toEqual(['a-metrics', 'a-traces']);
      expect(teamA.pagination.total).toBe(2);

      const teamATraces = await store.list({ page: 'traces', resourceId: 'team-a' });
      expect(teamATraces.views.map(view => view.id)).toEqual(['a-traces']);
      expect(teamATraces.pagination.total).toBe(1);

      expect((await store.list({ resourceId: 'team-c' })).views).toEqual([]);
      expect((await store.list()).pagination.total).toBe(4);
    });

    it('rejects an unknown orderBy field', async () => {
      await expect(store.list({ orderBy: { field: 'state' as never } })).rejects.toThrow(/Invalid orderBy field/);
    });

    it('updates only the given fields and bumps updatedAt', async () => {
      const created = await store.create(viewInput({ id: 'view-1' }));
      await sleep(10);

      const renamed = await store.update('view-1', { name: 'Renamed' });
      expect(renamed?.name).toBe('Renamed');
      expect(renamed?.page).toBe('traces');
      expect(renamed?.authorId).toBe('user-1');
      expect(renamed?.updatedById).toBe('user-1');
      expect(renamed?.state).toEqual(created.state);
      expect(renamed?.createdAt.getTime()).toBe(created.createdAt.getTime());
      expect(renamed!.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());

      const nextState = { version: 1, timeRange: { preset: 'custom', from: '2026-01-01', to: '2026-01-02' } };
      const restated = await store.update('view-1', { state: nextState });
      expect(restated?.name).toBe('Renamed');
      expect(restated?.state).toEqual(nextState);

      expect(await store.get('view-1')).toEqual(restated);
    });

    it('records who last changed a view', async () => {
      await store.create(viewInput({ id: 'view-1', resourceId: 'team-a' }));

      const edited = await store.update('view-1', { name: 'Renamed', updatedById: 'user-2' });
      expect(edited).toMatchObject({ authorId: 'user-1', updatedById: 'user-2', resourceId: 'team-a' });

      const anonymous = await store.update('view-1', { name: 'Renamed again', updatedById: null });
      expect(anonymous).toMatchObject({ authorId: 'user-1', updatedById: null });
      expect(await store.get('view-1')).toEqual(anonymous);
    });

    it('returns null when updating a missing view', async () => {
      expect(await store.update('missing', { name: 'Nope' })).toBeNull();
      expect(await store.get('missing')).toBeNull();
    });

    it('deletes a view, and deleting a missing view is a no-op', async () => {
      const created = await store.create(viewInput());
      const kept = await store.create(viewInput({ name: 'Kept' }));
      await store.delete(created.id);
      expect(await store.get(created.id)).toBeNull();
      expect(await store.get(kept.id)).not.toBeNull();
      await expect(store.delete(created.id)).resolves.toBeUndefined();
    });
  });
}
