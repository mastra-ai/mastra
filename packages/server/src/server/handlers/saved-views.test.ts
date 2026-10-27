import { Mastra } from '@mastra/core/mastra';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  createSavedViewBodySchema,
  listSavedViewsQuerySchema,
  MAX_SAVED_VIEW_STATE_BYTES,
  updateSavedViewBodySchema,
} from '../schemas/saved-views';
import { getEffectivePermission } from '../server-adapter/routes/permissions';
import {
  CREATE_SAVED_VIEW_ROUTE,
  DELETE_SAVED_VIEW_ROUTE,
  GET_SAVED_VIEW_ROUTE,
  LIST_SAVED_VIEWS_ROUTE,
  UPDATE_SAVED_VIEW_ROUTE,
} from './saved-views';

const state = {
  version: 1,
  timeRange: { preset: 'last-24h' },
  filter: {
    logic: 'and',
    nodes: [
      { fieldId: 'status', operatorId: 'is', value: 'error' },
      { kind: 'group', logic: 'or', nodes: [{ fieldId: 'environment', operatorId: 'is', value: 'prod' }] },
    ],
  },
  sort: { field: 'startedAt', direction: 'desc' },
  columnOrder: ['startTime', 'type'],
};

const ctx = (requestContext = new RequestContext()) => ({
  requestContext,
  abortSignal: new AbortController().signal,
});

const callerContext = (resourceId: string) => {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
  return requestContext;
};

async function expectHttpError(promise: Promise<unknown>, status: number) {
  const error = await promise.catch(caught => caught);
  expect(error).toBeInstanceOf(HTTPException);
  expect((error as HTTPException).status).toBe(status);
}

describe('saved view route permissions', () => {
  it('derives saved-views permissions from the path and method', () => {
    expect(getEffectivePermission(LIST_SAVED_VIEWS_ROUTE)).toBe('saved-views:read');
    expect(getEffectivePermission(GET_SAVED_VIEW_ROUTE)).toBe('saved-views:read');
    expect(getEffectivePermission(CREATE_SAVED_VIEW_ROUTE)).toBe('saved-views:write');
    expect(getEffectivePermission(UPDATE_SAVED_VIEW_ROUTE)).toBe('saved-views:write');
    expect(getEffectivePermission(DELETE_SAVED_VIEW_ROUTE)).toBe('saved-views:delete');
  });
});

describe('Saved views handlers', () => {
  let mastra: Mastra;

  beforeEach(() => {
    mastra = new Mastra({ logger: false, storage: new InMemoryStore() });
  });

  async function create(page = 'traces', name = 'Errors', requestContext?: RequestContext) {
    return CREATE_SAVED_VIEW_ROUTE.handler({ mastra, ...ctx(requestContext), page, name, state } as any);
  }

  it('creates a view and reads it back unchanged', async () => {
    const created = await create();

    expect(created).toMatchObject({ page: 'traces', name: 'Errors', authorId: null, updatedById: null, state });
    expect(created.id).toEqual(expect.any(String));
    expect(created).not.toHaveProperty('resourceId');

    const fetched = await GET_SAVED_VIEW_ROUTE.handler({ mastra, ...ctx(), savedViewId: created.id } as any);
    expect(fetched).toEqual(created);
  });

  it('records the caller as the author', async () => {
    const created = await create('traces', 'Mine', callerContext('user-1'));
    expect(created).toMatchObject({ authorId: 'user-1', updatedById: 'user-1' });
  });

  it('records the caller as the last editor', async () => {
    const created = await create('traces', 'Shared', callerContext('user-1'));

    const updated = await UPDATE_SAVED_VIEW_ROUTE.handler({
      mastra,
      ...ctx(callerContext('user-2')),
      savedViewId: created.id,
      name: 'Renamed',
    } as any);
    expect(updated).toMatchObject({ authorId: 'user-1', updatedById: 'user-2' });

    const fetched = await GET_SAVED_VIEW_ROUTE.handler({ mastra, ...ctx(), savedViewId: created.id } as any);
    expect(fetched.updatedById).toBe('user-2');
  });

  it('lists every view for a page, oldest first', async () => {
    const first = await create('traces', 'First');
    const second = await create('traces', 'Second');
    await create('metrics', 'Other page');

    const result = await LIST_SAVED_VIEWS_ROUTE.handler({ mastra, ...ctx(), page: 'traces' } as any);

    expect(result.views.map(view => view.id)).toEqual([first.id, second.id]);
    expect(result.pagination).toEqual({ total: 2, page: 0, perPage: 100, hasMore: false });

    const all = await LIST_SAVED_VIEWS_ROUTE.handler({ mastra, ...ctx() } as any);
    expect(all.views).toHaveLength(3);
  });

  it('pages through views with perPage and pageIndex', async () => {
    const ids: string[] = [];
    for (const name of ['One', 'Two', 'Three']) {
      ids.push((await create('traces', name)).id);
    }

    const list = (pageIndex: number) =>
      LIST_SAVED_VIEWS_ROUTE.handler({ mastra, ...ctx(), page: 'traces', perPage: 2, pageIndex } as any);

    const first = await list(0);
    expect(first.views.map(view => view.id)).toEqual(ids.slice(0, 2));
    expect(first.pagination).toEqual({ total: 3, page: 0, perPage: 2, hasMore: true });

    const second = await list(1);
    expect(second.views.map(view => view.id)).toEqual(ids.slice(2));
    expect(second.pagination).toEqual({ total: 3, page: 1, perPage: 2, hasMore: false });
  });

  it('updates only the given fields', async () => {
    const created = await create();

    const updated = await UPDATE_SAVED_VIEW_ROUTE.handler({
      mastra,
      ...ctx(),
      savedViewId: created.id,
      name: 'Renamed',
    } as any);

    expect(updated).toMatchObject({ id: created.id, name: 'Renamed', state });
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
  });

  it('deletes a view', async () => {
    const created = await create();

    const result = await DELETE_SAVED_VIEW_ROUTE.handler({ mastra, ...ctx(), savedViewId: created.id } as any);

    expect(result).toEqual({ deleted: true });
    await expectHttpError(GET_SAVED_VIEW_ROUTE.handler({ mastra, ...ctx(), savedViewId: created.id } as any), 404);
  });

  it('returns 404 for a missing view', async () => {
    await expectHttpError(GET_SAVED_VIEW_ROUTE.handler({ mastra, ...ctx(), savedViewId: 'missing' } as any), 404);
    await expectHttpError(
      UPDATE_SAVED_VIEW_ROUTE.handler({ mastra, ...ctx(), savedViewId: 'missing', name: 'x' } as any),
      404,
    );
    await expectHttpError(DELETE_SAVED_VIEW_ROUTE.handler({ mastra, ...ctx(), savedViewId: 'missing' } as any), 404);
  });

  describe('with stored resource scoping on', () => {
    let storage: InMemoryStore;

    beforeEach(() => {
      storage = new InMemoryStore();
      mastra = new Mastra({ logger: false, storage, server: { storedResources: { scope: true } } });
    });

    it('stores the caller scope on create and leaves it out of the response', async () => {
      const created = await create('traces', 'Team A', callerContext('team-a'));

      expect(created).not.toHaveProperty('resourceId');
      const savedViews = await storage.getStore('savedViews');
      expect((await savedViews!.get(created.id))?.resourceId).toBe('team-a');
    });

    it('only lists views in the caller scope', async () => {
      const teamA = await create('traces', 'Team A', callerContext('team-a'));
      await create('traces', 'Team B', callerContext('team-b'));
      const savedViews = await storage.getStore('savedViews');
      await savedViews!.create({ page: 'traces', name: 'From before scoping', state });

      const result = await LIST_SAVED_VIEWS_ROUTE.handler({
        mastra,
        ...ctx(callerContext('team-a')),
        page: 'traces',
      } as any);

      expect(result.views.map(view => view.id)).toEqual([teamA.id]);
      expect(result.pagination.total).toBe(1);
    });

    it("answers 404 for another scope's view and leaves it unchanged", async () => {
      const teamB = await create('traces', 'Team B', callerContext('team-b'));
      const teamA = ctx(callerContext('team-a'));

      await expectHttpError(GET_SAVED_VIEW_ROUTE.handler({ mastra, ...teamA, savedViewId: teamB.id } as any), 404);
      await expectHttpError(
        UPDATE_SAVED_VIEW_ROUTE.handler({ mastra, ...teamA, savedViewId: teamB.id, name: 'Taken' } as any),
        404,
      );
      await expectHttpError(DELETE_SAVED_VIEW_ROUTE.handler({ mastra, ...teamA, savedViewId: teamB.id } as any), 404);

      const fetched = await GET_SAVED_VIEW_ROUTE.handler({
        mastra,
        ...ctx(callerContext('team-b')),
        savedViewId: teamB.id,
      } as any);
      expect(fetched).toEqual(teamB);
    });

    it('lets the caller change and delete their own views', async () => {
      const teamA = ctx(callerContext('team-a'));
      const created = await create('traces', 'Team A', callerContext('team-a'));

      const updated = await UPDATE_SAVED_VIEW_ROUTE.handler({
        mastra,
        ...teamA,
        savedViewId: created.id,
        name: 'Renamed',
      } as any);
      expect(updated.name).toBe('Renamed');

      expect(await DELETE_SAVED_VIEW_ROUTE.handler({ mastra, ...teamA, savedViewId: created.id } as any)).toEqual({
        deleted: true,
      });
    });

    it('answers 403 when the request has no scope', async () => {
      await expectHttpError(LIST_SAVED_VIEWS_ROUTE.handler({ mastra, ...ctx(), page: 'traces' } as any), 403);
      await expectHttpError(create(), 403);
    });
  });

  describe('when the storage has no savedViews domain', () => {
    beforeEach(() => {
      const storage = new InMemoryStore();
      delete storage.stores.savedViews;
      mastra = new Mastra({ logger: false, storage });
    });

    it('returns 501 from every route', async () => {
      await expectHttpError(LIST_SAVED_VIEWS_ROUTE.handler({ mastra, ...ctx(), page: 'traces' } as any), 501);
      await expectHttpError(create(), 501);
      await expectHttpError(GET_SAVED_VIEW_ROUTE.handler({ mastra, ...ctx(), savedViewId: 'v' } as any), 501);
      await expectHttpError(
        UPDATE_SAVED_VIEW_ROUTE.handler({ mastra, ...ctx(), savedViewId: 'v', name: 'x' } as any),
        501,
      );
      await expectHttpError(DELETE_SAVED_VIEW_ROUTE.handler({ mastra, ...ctx(), savedViewId: 'v' } as any), 501);
    });
  });
});

describe('saved view schemas', () => {
  const body = { page: 'traces', name: 'Errors', state };

  it('accepts a valid body and keeps unknown payload keys', () => {
    const parsed = createSavedViewBodySchema.parse({ ...body, name: '  Errors  ' });
    expect(parsed.name).toBe('Errors');
    expect(parsed.state).toEqual(state);
  });

  it('rejects a payload without an integer version', () => {
    expect(createSavedViewBodySchema.safeParse({ ...body, state: { timeRange: {} } }).success).toBe(false);
    expect(createSavedViewBodySchema.safeParse({ ...body, state: { version: 1.5 } }).success).toBe(false);
    expect(createSavedViewBodySchema.safeParse({ ...body, state: [] }).success).toBe(false);
    expect(updateSavedViewBodySchema.safeParse({ state: { version: '1' } }).success).toBe(false);
  });

  it('rejects an oversized payload', () => {
    const oversized = { version: 1, blob: 'x'.repeat(MAX_SAVED_VIEW_STATE_BYTES) };
    expect(createSavedViewBodySchema.safeParse({ ...body, state: oversized }).success).toBe(false);
    expect(updateSavedViewBodySchema.safeParse({ state: oversized }).success).toBe(false);
  });

  it('rejects an empty or too long name and a missing page', () => {
    expect(createSavedViewBodySchema.safeParse({ ...body, name: '   ' }).success).toBe(false);
    expect(createSavedViewBodySchema.safeParse({ ...body, name: 'x'.repeat(81) }).success).toBe(false);
    expect(updateSavedViewBodySchema.safeParse({ name: '' }).success).toBe(false);
    const { page: _page, ...withoutPage } = body;
    expect(createSavedViewBodySchema.safeParse(withoutPage).success).toBe(false);
    expect(listSavedViewsQuerySchema.safeParse({ page: '' }).success).toBe(false);
  });

  it('defaults list pagination to the first 100 views and caps perPage at 100', () => {
    expect(listSavedViewsQuerySchema.parse({})).toEqual({ perPage: 100, pageIndex: 0 });
    expect(listSavedViewsQuerySchema.parse({ perPage: '25', pageIndex: '2' })).toEqual({ perPage: 25, pageIndex: 2 });
    expect(listSavedViewsQuerySchema.safeParse({ perPage: '0' }).success).toBe(false);
    expect(listSavedViewsQuerySchema.safeParse({ perPage: '101' }).success).toBe(false);
    expect(listSavedViewsQuerySchema.safeParse({ pageIndex: '-1' }).success).toBe(false);
  });
});
