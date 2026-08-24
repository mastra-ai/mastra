import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useStoredScorer, useStoredScorerMutations } from '../use-stored-scorers';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const SCORERS_URL = `${BASE_URL}/api/stored/scorers`;

const makeHarness = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  return { wrapper, queryClient };
};

const settle = () => new Promise(resolve => setTimeout(resolve, 50));

const scorer = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Scorer ${id}`,
  status: 'published',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('useStoredScorer', () => {
  describe('when the scorer exists', () => {
    it('exposes its definition', async () => {
      server.use(http.get(`${SCORERS_URL}/scorer-1`, () => HttpResponse.json(scorer('scorer-1'))));

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useStoredScorer('scorer-1'), { wrapper });

      await waitFor(() => expect(result.current.data?.id).toBe('scorer-1'));
    });
  });

  describe('when a status is requested', () => {
    it('forwards it so the draft can be read', async () => {
      let receivedUrl: URL | undefined;
      server.use(
        http.get(`${SCORERS_URL}/scorer-1`, ({ request }) => {
          receivedUrl = new URL(request.url);
          return HttpResponse.json(scorer('scorer-1', { status: 'draft' }));
        }),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useStoredScorer('scorer-1', { status: 'draft' }), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(receivedUrl?.searchParams.get('status')).toBe('draft');
    });

    it('keeps draft and published in separate cache entries', async () => {
      server.use(
        http.get(`${SCORERS_URL}/scorer-1`, ({ request }) => {
          const status = new URL(request.url).searchParams.get('status') ?? 'published';
          return HttpResponse.json(scorer('scorer-1', { name: `as-${status}` }));
        }),
      );
      const { wrapper } = makeHarness();

      const published = renderHook(() => useStoredScorer('scorer-1', { status: 'published' }), { wrapper });
      await waitFor(() => expect(published.result.current.data?.name).toBe('as-published'));

      const draft = renderHook(() => useStoredScorer('scorer-1', { status: 'draft' }), { wrapper });
      await waitFor(() => expect(draft.result.current.data?.name).toBe('as-draft'));

      expect(published.result.current.data?.name).toBe('as-published');
    });
  });

  describe('when no scorer is selected', () => {
    it('stays idle instead of fetching', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(`${SCORERS_URL}/:scorerId`, () => {
          onFetch();
          return HttpResponse.json(scorer('scorer-1'));
        }),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useStoredScorer(undefined), { wrapper });

      await settle();
      expect(onFetch).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('when two scorers are read through the same cache', () => {
    it('keeps each scorer in its own cache entry', async () => {
      server.use(
        http.get(`${SCORERS_URL}/:scorerId`, ({ params }) => HttpResponse.json(scorer(String(params.scorerId)))),
      );
      const { wrapper } = makeHarness();

      const first = renderHook(() => useStoredScorer('scorer-a'), { wrapper });
      await waitFor(() => expect(first.result.current.data?.id).toBe('scorer-a'));

      const second = renderHook(() => useStoredScorer('scorer-b'), { wrapper });
      await waitFor(() => expect(second.result.current.data?.id).toBe('scorer-b'));

      expect(first.result.current.data?.id).toBe('scorer-a');
    });
  });
});

describe('useStoredScorerMutations', () => {
  describe('creating a scorer', () => {
    it('posts the definition and refreshes both scorer lists', async () => {
      let body: unknown;
      server.use(
        http.post(SCORERS_URL, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json(scorer('scorer-new'));
        }),
      );

      const { wrapper, queryClient } = makeHarness();
      queryClient.setQueryData(['stored-scorers'], { scorers: [] });
      queryClient.setQueryData(['scorers'], {});
      queryClient.setQueryData(['stored-agents'], { agents: [] });

      const { result } = renderHook(() => useStoredScorerMutations(), { wrapper });
      await result.current.createStoredScorer.mutateAsync({ name: 'New scorer' } as never);

      expect(body).toMatchObject({ name: 'New scorer' });
      await waitFor(() => expect(queryClient.getQueryState(['stored-scorers'])?.isInvalidated).toBe(true));
      expect(queryClient.getQueryState(['scorers'])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['stored-agents'])?.isInvalidated).toBe(false);
    });
  });

  describe('updating a scorer', () => {
    it('patches it and refreshes its own cache entry too', async () => {
      server.use(http.patch(`${SCORERS_URL}/scorer-1`, () => HttpResponse.json(scorer('scorer-1'))));

      const { wrapper, queryClient } = makeHarness();
      queryClient.setQueryData(['stored-scorer', 'scorer-1'], scorer('scorer-1'));
      queryClient.setQueryData(['stored-scorer', 'scorer-2'], scorer('scorer-2'));

      const { result } = renderHook(() => useStoredScorerMutations('scorer-1'), { wrapper });
      await result.current.updateStoredScorer.mutateAsync({ name: 'Renamed' } as never);

      await waitFor(() => expect(queryClient.getQueryState(['stored-scorer', 'scorer-1'])?.isInvalidated).toBe(true));
      expect(queryClient.getQueryState(['stored-scorer', 'scorer-2'])?.isInvalidated).toBe(false);
    });

    it('refuses without a scorer id', async () => {
      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useStoredScorerMutations(undefined), { wrapper });

      await expect(result.current.updateStoredScorer.mutateAsync({ name: 'x' } as never)).rejects.toThrow(
        /scorerId is required/,
      );
    });
  });

  describe('deleting a scorer', () => {
    it('removes it and refreshes the lists', async () => {
      const onDelete = vi.fn();
      server.use(
        http.delete(`${SCORERS_URL}/scorer-1`, () => {
          onDelete();
          return HttpResponse.json({ success: true });
        }),
      );

      const { wrapper, queryClient } = makeHarness();
      queryClient.setQueryData(['stored-scorers'], { scorers: [] });

      const { result } = renderHook(() => useStoredScorerMutations('scorer-1'), { wrapper });
      await result.current.deleteStoredScorer.mutateAsync();

      expect(onDelete).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(queryClient.getQueryState(['stored-scorers'])?.isInvalidated).toBe(true));
    });

    it('refuses without a scorer id', async () => {
      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useStoredScorerMutations(undefined), { wrapper });

      await expect(result.current.deleteStoredScorer.mutateAsync()).rejects.toThrow(/scorerId is required/);
    });
  });

  describe('when a mutation fails', () => {
    it('leaves the caches alone', async () => {
      server.use(http.patch(`${SCORERS_URL}/scorer-1`, () => new HttpResponse(null, { status: 400 })));

      const { wrapper, queryClient } = makeHarness();
      queryClient.setQueryData(['stored-scorers'], { scorers: [] });

      const { result } = renderHook(() => useStoredScorerMutations('scorer-1'), { wrapper });
      await expect(result.current.updateStoredScorer.mutateAsync({ name: 'x' } as never)).rejects.toThrow();

      expect(queryClient.getQueryState(['stored-scorers'])?.isInvalidated).toBe(false);
    });
  });
});
