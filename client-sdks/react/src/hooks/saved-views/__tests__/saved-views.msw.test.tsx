// @vitest-environment jsdom
import '../../../test/jsdom-polyfills';
import type { SavedViewResponse } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isSavedViewsUnavailableError,
  useCreateSavedView,
  useDeleteSavedView,
  useSavedViews,
  useUpdateSavedView,
} from '..';
import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';

const BASE_URL = 'http://localhost:4111';
const SAVED_VIEWS_URL = `${BASE_URL}/api/saved-views`;

const view: SavedViewResponse = {
  id: 'view-1',
  page: 'traces',
  name: 'Errors',
  authorId: null,
  updatedById: null,
  state: { version: 1, filters: [], settings: { datePreset: 'last-24h', sortDirection: 'desc' } },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const listResponse = (views: SavedViewResponse[]) => ({
  views,
  pagination: { total: views.length, page: 0, perPage: 100, hasMore: false },
});

// Retries stay on so the tests prove the hook itself never retries 404/501.
const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

afterEach(() => cleanup());

describe('useSavedViews', () => {
  describe('when the server has saved views', () => {
    it('lists the views for a page', async () => {
      const onList = vi.fn<(page: string | null) => void>();
      server.use(
        http.get(SAVED_VIEWS_URL, ({ request }) => {
          onList(new URL(request.url).searchParams.get('page'));
          return HttpResponse.json(listResponse([view]));
        }),
      );

      const { result } = renderHook(() => useSavedViews({ page: 'traces' }), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([view]);
      expect(onList).toHaveBeenCalledWith('traces');
    });
  });

  describe('when the views span more than one page', () => {
    it('fetches every page', async () => {
      const second = { ...view, id: 'view-2', name: 'Slow' };
      const onList = vi.fn<(pageIndex: string | null) => void>();
      server.use(
        http.get(SAVED_VIEWS_URL, ({ request }) => {
          const pageIndex = new URL(request.url).searchParams.get('pageIndex');
          onList(pageIndex);
          const page = Number(pageIndex);
          return HttpResponse.json({
            views: page === 0 ? [view] : [second],
            pagination: { total: 2, page, perPage: 1, hasMore: page === 0 },
          });
        }),
      );

      const { result } = renderHook(() => useSavedViews({ page: 'traces' }), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([view, second]);
      expect(onList.mock.calls).toEqual([['0'], ['1']]);
    });
  });

  describe('when the server ignores pageIndex', () => {
    it('stops after the first page instead of looping', async () => {
      const onList = vi.fn();
      server.use(
        http.get(SAVED_VIEWS_URL, () => {
          onList();
          return HttpResponse.json({ views: [view], pagination: { total: 101, page: 0, perPage: 100, hasMore: true } });
        }),
      );

      const { result } = renderHook(() => useSavedViews({ page: 'traces' }), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([view]);
      expect(onList).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the server cannot serve saved views', () => {
    it.each([404, 501])('reports %i as unavailable without retrying', async status => {
      const onList = vi.fn();
      server.use(
        http.get(SAVED_VIEWS_URL, () => {
          onList();
          return HttpResponse.json({ error: 'Saved views are not supported by this storage' }, { status });
        }),
      );

      const { result } = renderHook(() => useSavedViews({ page: 'traces' }), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(isSavedViewsUnavailableError(result.current.error)).toBe(true);
      expect(onList).toHaveBeenCalledTimes(1);
    });
  });
});

describe('isSavedViewsUnavailableError', () => {
  describe('when the failure is not a 404 or 501', () => {
    it('returns false', () => {
      expect(isSavedViewsUnavailableError(new Error('boom'))).toBe(false);
      expect(isSavedViewsUnavailableError({ status: 500 })).toBe(false);
      expect(isSavedViewsUnavailableError(undefined)).toBe(false);
    });
  });
});

describe('useCreateSavedView', () => {
  describe('when the create succeeds', () => {
    it('returns the created view and refreshes the list', async () => {
      const created = { ...view, id: 'view-2', name: 'Slow' };
      const onPost = vi.fn<(body: unknown) => void>();
      let views = [view];
      server.use(
        http.get(SAVED_VIEWS_URL, () => HttpResponse.json(listResponse(views))),
        http.post(SAVED_VIEWS_URL, async ({ request }) => {
          onPost(await request.json());
          views = [...views, created];
          return HttpResponse.json(created);
        }),
      );
      const wrapper = makeWrapper();
      const { result: list } = renderHook(() => useSavedViews({ page: 'traces' }), { wrapper });
      const { result: create } = renderHook(() => useCreateSavedView(), { wrapper });
      await waitFor(() => expect(list.current.data).toHaveLength(1));

      const body = { page: 'traces', name: 'Slow', state: view.state };
      await expect(create.current.mutateAsync(body)).resolves.toEqual(created);

      expect(onPost).toHaveBeenCalledWith(body);
      await waitFor(() => expect(list.current.data).toEqual([view, created]));
    });
  });
});

describe('useUpdateSavedView', () => {
  describe('when the update succeeds', () => {
    it('patches the view by id and refreshes the list', async () => {
      const renamed = { ...view, name: 'Renamed' };
      const onPatch = vi.fn<(id: string, body: unknown) => void>();
      let views = [view];
      server.use(
        http.get(SAVED_VIEWS_URL, () => HttpResponse.json(listResponse(views))),
        http.patch(`${SAVED_VIEWS_URL}/:savedViewId`, async ({ params, request }) => {
          onPatch(params.savedViewId as string, await request.json());
          views = [renamed];
          return HttpResponse.json(renamed);
        }),
      );
      const wrapper = makeWrapper();
      const { result: list } = renderHook(() => useSavedViews({ page: 'traces' }), { wrapper });
      const { result: update } = renderHook(() => useUpdateSavedView(), { wrapper });
      await waitFor(() => expect(list.current.data).toEqual([view]));

      await expect(update.current.mutateAsync({ savedViewId: 'view-1', name: 'Renamed' })).resolves.toEqual(renamed);

      expect(onPatch).toHaveBeenCalledWith('view-1', { name: 'Renamed' });
      await waitFor(() => expect(list.current.data).toEqual([renamed]));
    });
  });
});

describe('useDeleteSavedView', () => {
  describe('when the delete succeeds', () => {
    it('deletes the view by id and refreshes the list', async () => {
      const onDelete = vi.fn<(id: string) => void>();
      let views = [view];
      server.use(
        http.get(SAVED_VIEWS_URL, () => HttpResponse.json(listResponse(views))),
        http.delete(`${SAVED_VIEWS_URL}/:savedViewId`, ({ params }) => {
          onDelete(params.savedViewId as string);
          views = [];
          return HttpResponse.json({ deleted: true });
        }),
      );
      const wrapper = makeWrapper();
      const { result: list } = renderHook(() => useSavedViews({ page: 'traces' }), { wrapper });
      const { result: remove } = renderHook(() => useDeleteSavedView(), { wrapper });
      await waitFor(() => expect(list.current.data).toHaveLength(1));

      await remove.current.mutateAsync('view-1');

      expect(onDelete).toHaveBeenCalledWith('view-1');
      await waitFor(() => expect(list.current.data).toEqual([]));
    });
  });
});
