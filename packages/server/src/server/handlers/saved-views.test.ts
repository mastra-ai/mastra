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

    expect(created).toMatchObject({ page: 'traces', name: 'Errors', authorId: null, state });
    expect(created.id).toEqual(expect.any(String));

    const fetched = await GET_SAVED_VIEW_ROUTE.handler({ mastra, ...ctx(), savedViewId: created.id } as any);
    expect(fetched).toEqual(created);
  });

  it('records the caller as the author', async () => {
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

    const created = await create('traces', 'Mine', requestContext);
    expect(created.authorId).toBe('user-1');
  });

  it('lists every view for a page, oldest first', async () => {
    const first = await create('traces', 'First');
    const second = await create('traces', 'Second');
    await create('metrics', 'Other page');

    const result = await LIST_SAVED_VIEWS_ROUTE.handler({ mastra, ...ctx(), page: 'traces' } as any);

    expect(result.views.map(view => view.id)).toEqual([first.id, second.id]);
    expect(result.pagination).toMatchObject({ total: 2, hasMore: false });

    const all = await LIST_SAVED_VIEWS_ROUTE.handler({ mastra, ...ctx() } as any);
    expect(all.views).toHaveLength(3);
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

    expect(result).toEqual({ message: 'Saved view deleted' });
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
});
