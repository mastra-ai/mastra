// @vitest-environment jsdom
import type { IntakeNotRoutedResponse } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import { TEST_BASE_URL } from '../../../test/render';
import { factoryKeys } from '../keys';
import { useDeleteBoardMutation, useIntakeRouteWrites, useNotRoutedQuery, useRouteAgain } from '../use-board-settings';

const FP = 'fp-1';
const API = `${TEST_BASE_URL}/web/factory/projects/${FP}`;

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={TEST_BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  return { queryClient, wrapper };
}

describe('Factory board settings hooks', () => {
  describe('when a board is deleted', () => {
    it('drops a deleted board from the catalog before telling the caller', async () => {
      server.use(http.delete(`${API}/boards/bugs`, () => HttpResponse.json({ ok: true })));
      const { queryClient, wrapper } = setup();
      queryClient.setQueryData(factoryKeys.boardCatalog(FP), { boards: [{ id: 'work' }, { id: 'bugs' }] });
      let seen: unknown;
      const { result } = renderHook(
        () => useDeleteBoardMutation(FP, 'bugs', () => (seen = queryClient.getQueryData(factoryKeys.boardCatalog(FP)))),
        { wrapper },
      );
      await act(() => result.current.mutateAsync(3));
      expect(seen).toEqual({ boards: [{ id: 'work' }] });
    });
  });

  describe('when several rule writes are sent', () => {
    it('sends rule writes in order and returns the rules it created', async () => {
      const calls: string[] = [];
      server.use(
        http.post(`${API}/intake-routes`, () => {
          calls.push('create');
          return HttpResponse.json({ intakeRoute: { id: 'r2' } });
        }),
        http.delete(`${API}/intake-routes/r1`, ({ request }) => {
          calls.push(`delete ${new URL(request.url).searchParams.get('expectedRevision')}`);
          return HttpResponse.json({ ok: true });
        }),
        http.post(`${API}/intake-routes/reorder`, async ({ request }) => {
          calls.push(`reorder ${JSON.stringify(await request.json())}`);
          return HttpResponse.json({ intakeRoutes: [] });
        }),
      );
      const { wrapper } = setup();
      const { result } = renderHook(() => useIntakeRouteWrites(FP), { wrapper });
      const created = await act(() =>
        result.current.mutateAsync([
          { kind: 'create', route: {} as never },
          { kind: 'delete', id: 'r1', expectedRevision: 2 },
          { kind: 'reorder', ids: ['r2'], boardKey: 'work' },
        ]),
      );
      expect(calls).toEqual(['create', 'delete 2', 'reorder {"ids":["r2"],"boardKey":"work"}']);
      expect(created).toEqual([{ id: 'r2' }]);
    });
  });

  describe('when a Not routed item is routed again', () => {
    it('pages Not routed items and takes one off the list once it is routed again', async () => {
      server.use(
        http.get(`${API}/intake/not-routed`, ({ request }) => {
          const cursor = new URL(request.url).searchParams.get('cursor');
          return HttpResponse.json(
            cursor ? { notRouted: [{ id: 'd2' }], nextCursor: null } : { notRouted: [{ id: 'd1' }], nextCursor: 'c1' },
          );
        }),
        http.post(`${API}/intake/not-routed/d1/route-again`, () => HttpResponse.json({ ok: true })),
      );
      const { wrapper } = setup();
      const { result } = renderHook(() => ({ list: useNotRoutedQuery(FP), again: useRouteAgain(FP) }), { wrapper });
      await waitFor(() => expect(result.current.list.data?.pages).toHaveLength(1));
      await act(() => result.current.list.fetchNextPage());
      await act(() => result.current.again.mutateAsync('d1'));
      await waitFor(() =>
        expect(
          result.current.list.data?.pages.flatMap((page: IntakeNotRoutedResponse) => page.notRouted.map(i => i.id)),
        ).toEqual(['d2']),
      );
    });
  });
});
