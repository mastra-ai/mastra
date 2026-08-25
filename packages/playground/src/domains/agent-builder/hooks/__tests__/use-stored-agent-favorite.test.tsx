import type { ListStoredAgentsResponse, StoredAgentResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useToggleStoredAgentFavorite } from '../use-stored-agent-favorite';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';
const FAVORITE_URL = `${BASE_URL}/api/stored/agents/${AGENT_ID}/favorite`;

const makeAgent = (overrides: Partial<StoredAgentResponse> = {}): StoredAgentResponse =>
  ({
    id: AGENT_ID,
    status: 'published',
    name: 'Researcher',
    instructions: '',
    model: { provider: 'google', name: 'gemini-2.5-flash' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isFavorited: false,
    favoriteCount: 0,
    ...overrides,
  }) as StoredAgentResponse;

const makeList = (agents: StoredAgentResponse[]): ListStoredAgentsResponse =>
  ({ agents, total: agents.length, page: 1, perPage: 50, hasMore: false }) as ListStoredAgentsResponse;

const setup = ({
  omitAgentId = false,
  detail,
  lists = {},
}: {
  omitAgentId?: boolean;
  detail?: StoredAgentResponse | null;
  lists?: Record<string, ListStoredAgentsResponse | undefined>;
} = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  if (detail !== undefined) queryClient.setQueryData(['stored-agent', AGENT_ID], detail);
  for (const [suffix, value] of Object.entries(lists)) {
    queryClient.setQueryData(['stored-agents', suffix], value);
  }

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );

  const { result } = renderHook(() => useToggleStoredAgentFavorite(omitAgentId ? undefined : AGENT_ID), { wrapper });
  return { result, queryClient };
};

const detailOf = (queryClient: QueryClient) =>
  queryClient.getQueryData<StoredAgentResponse>(['stored-agent', AGENT_ID]);
const listOf = (queryClient: QueryClient, suffix = 'all') =>
  queryClient.getQueryData<ListStoredAgentsResponse>(['stored-agents', suffix]);

/** Holds the server response open so the optimistic cache state can be observed. */
const pendingFavorite = () => {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  server.use(
    http.put(FAVORITE_URL, async () => {
      await gate;
      return HttpResponse.json({ favorited: true, favoriteCount: 1 });
    }),
  );
  return () => act(async () => release());
};

describe('useToggleStoredAgentFavorite', () => {
  describe('while the request is in flight', () => {
    it('shows the agent as favorited before the server answers', async () => {
      const { result, queryClient } = setup({ detail: makeAgent() });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));

      await waitFor(() => expect(detailOf(queryClient)?.isFavorited).toBe(true));
      expect(detailOf(queryClient)?.favoriteCount).toBe(1);

      await release();
    });

    it('patches only the agent that was toggled in a list', async () => {
      const other = makeAgent({ id: 'agent-2', favoriteCount: 7 });
      const { result, queryClient } = setup({ lists: { all: makeList([makeAgent(), other]) } });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));

      await waitFor(() => expect(listOf(queryClient)?.agents[0].isFavorited).toBe(true));
      expect(listOf(queryClient)?.agents[1]).toEqual(other);

      await release();
    });

    it('patches every list cache, not just the first', async () => {
      const { result, queryClient } = setup({
        lists: { all: makeList([makeAgent()]), favorites: makeList([makeAgent()]) },
      });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));

      await waitFor(() => expect(listOf(queryClient, 'all')?.agents[0].isFavorited).toBe(true));
      expect(listOf(queryClient, 'favorites')?.agents[0].isFavorited).toBe(true);

      await release();
    });

    it('leaves a list cache that has no agents alone', async () => {
      const { result, queryClient } = setup({ lists: { all: undefined } });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));
      await release();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(listOf(queryClient)).toBeUndefined();
    });

    it('leaves a list entry cached as nothing alone', async () => {
      const { result, queryClient } = setup();
      queryClient.setQueryData(['stored-agents', 'all'], null);
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));
      await release();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(queryClient.getQueryData(['stored-agents', 'all'])).toBeNull();
    });

    it('leaves a list entry that carries no rows alone', async () => {
      const rowless = { total: 0, page: 1, perPage: 50, hasMore: false } as ListStoredAgentsResponse;
      const { result, queryClient } = setup({ lists: { all: rowless } });
      const writtenAt = queryClient.getQueryState(['stored-agents', 'all'])?.dataUpdatedAt;
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));
      await release();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(listOf(queryClient)).toEqual(rowless);
      expect(queryClient.getQueryState(['stored-agents', 'all'])?.dataUpdatedAt).toBe(writtenAt);
    });
  });

  describe('the favourite count it predicts', () => {
    it('does not double-count an agent that is already favorited', async () => {
      const { result, queryClient } = setup({ detail: makeAgent({ isFavorited: true, favoriteCount: 3 }) });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));

      await waitFor(() => expect(detailOf(queryClient)?.isFavorited).toBe(true));
      expect(detailOf(queryClient)?.favoriteCount).toBe(3);

      await release();
    });

    it('decrements when a favorited agent is unfavorited', async () => {
      server.use(http.delete(FAVORITE_URL, () => HttpResponse.json({ favorited: false, favoriteCount: 2 })));
      const { result, queryClient } = setup({ detail: makeAgent({ isFavorited: true, favoriteCount: 3 }) });

      await act(async () => {
        await result.current.mutateAsync({ favorited: false });
      });

      expect(detailOf(queryClient)?.favoriteCount).toBe(2);
    });

    it('never predicts a negative count', async () => {
      server.use(http.delete(FAVORITE_URL, () => HttpResponse.json({ favorited: false, favoriteCount: 0 })));
      const { result, queryClient } = setup({ detail: makeAgent({ isFavorited: true, favoriteCount: 0 }) });

      await act(async () => {
        await result.current.mutateAsync({ favorited: false });
      });

      expect(detailOf(queryClient)?.favoriteCount).toBe(0);
    });

    it('leaves the count alone when unfavoriting something that was not favorited', async () => {
      server.use(http.delete(FAVORITE_URL, () => HttpResponse.json({ favorited: false, favoriteCount: 5 })));
      const { result, queryClient } = setup({ detail: makeAgent({ isFavorited: false, favoriteCount: 5 }) });

      await act(async () => {
        await result.current.mutateAsync({ favorited: false });
      });

      expect(detailOf(queryClient)?.favoriteCount).toBe(5);
    });

    it('treats a missing count as zero', async () => {
      const { result, queryClient } = setup({ detail: makeAgent({ favoriteCount: undefined }) });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));

      await waitFor(() => expect(detailOf(queryClient)?.favoriteCount).toBe(1));

      await release();
    });
  });

  describe('when the server rejects the toggle', () => {
    it('puts the detail cache back the way it was', async () => {
      server.use(http.put(FAVORITE_URL, () => new HttpResponse(null, { status: 500 })));
      const before = makeAgent({ isFavorited: false, favoriteCount: 4 });
      const { result, queryClient } = setup({ detail: before });

      await act(async () => {
        await result.current.mutateAsync({ favorited: true }).catch(() => {});
      });

      await waitFor(() => expect(detailOf(queryClient)).toEqual(before));
    });

    it('puts every list cache back the way it was', async () => {
      server.use(http.put(FAVORITE_URL, () => new HttpResponse(null, { status: 500 })));
      const before = makeList([makeAgent({ favoriteCount: 4 })]);
      const { result, queryClient } = setup({ lists: { all: before } });

      await act(async () => {
        await result.current.mutateAsync({ favorited: true }).catch(() => {});
      });

      await waitFor(() => expect(listOf(queryClient)).toEqual(before));
    });

    it('reports the failure to the caller', async () => {
      server.use(http.put(FAVORITE_URL, () => new HttpResponse(null, { status: 500 })));
      const { result } = setup({ detail: makeAgent() });

      await act(async () => {
        await result.current.mutateAsync({ favorited: true }).catch(() => {});
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('once the toggle settles', () => {
    it('re-reads the detail and the lists from the server', async () => {
      server.use(http.put(FAVORITE_URL, () => HttpResponse.json({ favorited: true, favoriteCount: 1 })));
      const { result, queryClient } = setup({ detail: makeAgent(), lists: { all: makeList([makeAgent()]) } });

      await act(async () => {
        await result.current.mutateAsync({ favorited: true });
      });

      await waitFor(() => {
        expect(queryClient.getQueryState(['stored-agent', AGENT_ID])?.isInvalidated).toBe(true);
        expect(queryClient.getQueryState(['stored-agents', 'all'])?.isInvalidated).toBe(true);
      });
    });
  });

  describe('when the hook has no agent id', () => {
    it('refuses to send anything', async () => {
      let requested = false;
      server.use(
        http.put(`${BASE_URL}/api/stored/agents/:id/favorite`, () => {
          requested = true;
          return HttpResponse.json({ favorited: true, favoriteCount: 1 });
        }),
      );
      const { result } = setup({ omitAgentId: true });

      let thrown: unknown;
      await act(async () => {
        await result.current.mutateAsync({ favorited: true }).catch((error: unknown) => {
          thrown = error;
        });
      });

      expect((thrown as Error)?.message).toContain('agentId is required');
      expect(requested).toBe(false);
    });

    it('leaves the caches untouched', async () => {
      const before = makeList([makeAgent()]);
      const { result, queryClient } = setup({ omitAgentId: true, lists: { all: before } });
      // React Query keeps the same object for an equal value, so identity
      // cannot tell "never written" from "rewritten identically" — the write
      // timestamp can.
      const writtenAt = queryClient.getQueryState(['stored-agents', 'all'])?.dataUpdatedAt;

      await act(async () => {
        await result.current.mutateAsync({ favorited: true }).catch(() => {});
      });

      expect(listOf(queryClient)).toEqual(before);
      expect(queryClient.getQueryState(['stored-agents', 'all'])?.dataUpdatedAt).toBe(writtenAt);
    });

    it('rolls back through an empty snapshot, inventing no cache entries', async () => {
      const { result, queryClient } = setup({ omitAgentId: true, lists: { all: makeList([makeAgent()]) } });
      const entryCount = queryClient.getQueryCache().getAll().length;

      await act(async () => {
        await result.current.mutateAsync({ favorited: true }).catch(() => {});
      });

      expect(queryClient.getQueryCache().getAll()).toHaveLength(entryCount);
    });
  });

  describe('when the detail cache is empty', () => {
    it('does not invent a detail entry from the optimistic update', async () => {
      const { result, queryClient } = setup({});
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));
      await release();

      expect(queryClient.getQueryData(['stored-agent', AGENT_ID])).toBeUndefined();
    });
  });

  describe('the work it cancels before patching', () => {
    it('keeps the optimistic patch even though a list refetch was already in flight', async () => {
      let releaseList: () => void = () => {};
      const listInFlight = new Promise<void>(resolve => {
        releaseList = resolve;
      });
      server.use(
        http.get(`${BASE_URL}/api/stored/agents`, async () => {
          await listInFlight;
          return HttpResponse.json(makeList([makeAgent({ favoriteCount: 0, isFavorited: false })]));
        }),
      );

      const { result, queryClient } = setup({ lists: { all: makeList([makeAgent()]) } });
      // Put a refetch of the list in flight, then toggle underneath it.
      void queryClient.fetchQuery({
        queryKey: ['stored-agents', 'all'],
        queryFn: async () => {
          const response = await fetch(`${BASE_URL}/api/stored/agents`);
          return (await response.json()) as ListStoredAgentsResponse;
        },
      });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));
      await waitFor(() => expect(listOf(queryClient)?.agents[0].isFavorited).toBe(true));

      await act(async () => releaseList());
      await release();

      // Without the cancel, the stale in-flight response would land on top of
      // the optimistic patch and flip the star back off.
      expect(listOf(queryClient)?.agents[0].isFavorited).toBe(true);
    });

    it('cancels an in-flight read of the agent itself, not just the lists', async () => {
      let releaseDetail: () => void = () => {};
      const detailInFlight = new Promise<void>(resolve => {
        releaseDetail = resolve;
      });
      server.use(
        http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, async () => {
          await detailInFlight;
          return HttpResponse.json(makeAgent({ isFavorited: false, favoriteCount: 0 }));
        }),
      );

      const { result, queryClient } = setup({ detail: makeAgent() });
      void queryClient.fetchQuery({
        queryKey: ['stored-agent', AGENT_ID],
        queryFn: async () => {
          const response = await fetch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`);
          return (await response.json()) as StoredAgentResponse;
        },
      });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));
      await waitFor(() => expect(detailOf(queryClient)?.isFavorited).toBe(true));

      await act(async () => releaseDetail());
      await release();

      // Without the cancel, the stale in-flight detail would land on top of the
      // optimistic patch and flip the star back off.
      expect(detailOf(queryClient)?.isFavorited).toBe(true);
    });

    it('does not snapshot caches it has no business restoring', async () => {
      server.use(http.put(FAVORITE_URL, () => new HttpResponse(null, { status: 500 })));
      const { result, queryClient } = setup({ lists: { all: makeList([makeAgent()]) } });
      queryClient.setQueryData(['stored-workflows'], { seeded: true });
      const unrelatedWrittenAt = queryClient.getQueryState(['stored-workflows'])?.dataUpdatedAt;

      await act(async () => {
        await result.current.mutateAsync({ favorited: true }).catch(() => {});
      });

      // A rollback that restored every cache would rewrite this one too.
      expect(queryClient.getQueryState(['stored-workflows'])?.dataUpdatedAt).toBe(unrelatedWrittenAt);
    });

    it('does not cancel unrelated work', async () => {
      let releaseOther: () => void = () => {};
      const otherInFlight = new Promise<void>(resolve => {
        releaseOther = resolve;
      });

      const { result, queryClient } = setup({ detail: makeAgent() });
      const other = queryClient.fetchQuery({
        queryKey: ['stored-workflows'],
        // Honours the abort signal, so a cancel that swept up every query would
        // reject here instead of passing unnoticed.
        queryFn: ({ signal }) =>
          new Promise<{ ok: boolean }>((resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('cancelled')));
            void otherInFlight.then(() => resolve({ ok: true }));
          }),
      });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));
      // The optimistic patch lands after both cancels, so waiting for it makes
      // the release below strictly later than the cancelling.
      await waitFor(() => expect(detailOf(queryClient)?.isFavorited).toBe(true));
      await act(async () => releaseOther());
      await release();

      await expect(other).resolves.toEqual({ ok: true });
    });
  });

  describe('the caches it refreshes once the toggle settles', () => {
    it('leaves unrelated caches alone', async () => {
      server.use(http.put(FAVORITE_URL, () => HttpResponse.json({ favorited: true, favoriteCount: 1 })));
      const { result, queryClient } = setup({ detail: makeAgent() });
      queryClient.setQueryData(['stored-workflows'], { seeded: true });

      await act(async () => {
        await result.current.mutateAsync({ favorited: true });
      });

      expect(queryClient.getQueryState(['stored-workflows'])?.isInvalidated).toBe(false);
    });
  });

  describe('when the toggle fails and there was no detail cached', () => {
    it('does not leave an empty detail entry behind', async () => {
      server.use(http.put(FAVORITE_URL, () => new HttpResponse(null, { status: 500 })));
      const { result, queryClient } = setup({ lists: { all: makeList([makeAgent()]) } });

      await act(async () => {
        await result.current.mutateAsync({ favorited: true }).catch(() => {});
      });

      expect(queryClient.getQueryCache().find({ queryKey: ['stored-agent', AGENT_ID] })).toBeUndefined();
    });

    it('does not invent cache entries while rolling the lists back', async () => {
      server.use(http.put(FAVORITE_URL, () => new HttpResponse(null, { status: 500 })));
      const { result, queryClient } = setup({ lists: { all: makeList([makeAgent()]) } });
      const before = queryClient.getQueryCache().getAll().length;

      await act(async () => {
        await result.current.mutateAsync({ favorited: true }).catch(() => {});
      });

      expect(queryClient.getQueryCache().getAll()).toHaveLength(before);
    });
  });
});
