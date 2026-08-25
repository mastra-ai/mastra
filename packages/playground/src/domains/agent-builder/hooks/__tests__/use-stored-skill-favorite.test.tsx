import type { ListStoredSkillsResponse, StoredSkillResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useToggleStoredSkillFavorite } from '../use-stored-skill-favorite';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const SKILL_ID = 'skill-1';
const FAVORITE_URL = `${BASE_URL}/api/stored/skills/${SKILL_ID}/favorite`;

const makeSkill = (overrides: Partial<StoredSkillResponse> = {}): StoredSkillResponse =>
  ({
    id: SKILL_ID,
    status: 'active',
    name: 'Code reviewer',
    description: 'Reviews pull requests',
    instructions: '',
    visibility: 'private',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isFavorited: false,
    favoriteCount: 0,
    ...overrides,
  }) as StoredSkillResponse;

const makeList = (skills: StoredSkillResponse[]): ListStoredSkillsResponse =>
  ({ skills, total: skills.length, page: 1, perPage: 50, hasMore: false }) as ListStoredSkillsResponse;

const setup = ({
  omitSkillId = false,
  detail,
  lists = {},
}: {
  omitSkillId?: boolean;
  detail?: StoredSkillResponse | null;
  lists?: Record<string, ListStoredSkillsResponse | undefined>;
} = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  if (detail !== undefined) queryClient.setQueryData(['stored-skill', SKILL_ID], detail);
  for (const [suffix, value] of Object.entries(lists)) {
    queryClient.setQueryData(['stored-skills', suffix], value);
  }

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );

  const { result } = renderHook(() => useToggleStoredSkillFavorite(omitSkillId ? undefined : SKILL_ID), { wrapper });
  return { result, queryClient };
};

const detailOf = (queryClient: QueryClient) =>
  queryClient.getQueryData<StoredSkillResponse>(['stored-skill', SKILL_ID]);
const listOf = (queryClient: QueryClient, suffix = 'all') =>
  queryClient.getQueryData<ListStoredSkillsResponse>(['stored-skills', suffix]);

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

describe('useToggleStoredSkillFavorite', () => {
  describe('while the request is in flight', () => {
    it('shows the skill as favorited before the server answers', async () => {
      const { result, queryClient } = setup({ detail: makeSkill() });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));

      await waitFor(() => expect(detailOf(queryClient)?.isFavorited).toBe(true));
      expect(detailOf(queryClient)?.favoriteCount).toBe(1);

      await release();
    });

    it('patches only the skill that was toggled in a list', async () => {
      const other = makeSkill({ id: 'skill-2', favoriteCount: 7 });
      const { result, queryClient } = setup({ lists: { all: makeList([makeSkill(), other]) } });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));

      await waitFor(() => expect(listOf(queryClient)?.skills[0].isFavorited).toBe(true));
      expect(listOf(queryClient)?.skills[1]).toEqual(other);

      await release();
    });

    it('patches every list cache, not just the first', async () => {
      const { result, queryClient } = setup({
        lists: { all: makeList([makeSkill()]), favorites: makeList([makeSkill()]) },
      });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));

      await waitFor(() => expect(listOf(queryClient, 'all')?.skills[0].isFavorited).toBe(true));
      expect(listOf(queryClient, 'favorites')?.skills[0].isFavorited).toBe(true);

      await release();
    });

    it('leaves a list cache that has no skills alone', async () => {
      const { result, queryClient } = setup({ lists: { all: undefined } });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));
      await release();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(listOf(queryClient)).toBeUndefined();
    });

    it('leaves a list entry that carries no rows alone', async () => {
      const rowless = { total: 0, page: 1, perPage: 50, hasMore: false } as ListStoredSkillsResponse;
      const { result, queryClient } = setup({ lists: { all: rowless } });
      const writtenAt = queryClient.getQueryState(['stored-skills', 'all'])?.dataUpdatedAt;
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));
      await release();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(listOf(queryClient)).toEqual(rowless);
      expect(queryClient.getQueryState(['stored-skills', 'all'])?.dataUpdatedAt).toBe(writtenAt);
    });
  });

  describe('the favourite count it predicts', () => {
    it('does not double-count a skill that is already favorited', async () => {
      const { result, queryClient } = setup({ detail: makeSkill({ isFavorited: true, favoriteCount: 3 }) });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));

      await waitFor(() => expect(detailOf(queryClient)?.isFavorited).toBe(true));
      expect(detailOf(queryClient)?.favoriteCount).toBe(3);

      await release();
    });

    it('decrements when a favorited skill is unfavorited', async () => {
      server.use(http.delete(FAVORITE_URL, () => HttpResponse.json({ favorited: false, favoriteCount: 2 })));
      const { result, queryClient } = setup({ detail: makeSkill({ isFavorited: true, favoriteCount: 3 }) });

      await act(async () => {
        await result.current.mutateAsync({ favorited: false });
      });

      expect(detailOf(queryClient)?.favoriteCount).toBe(2);
    });

    it('never predicts a negative count', async () => {
      server.use(http.delete(FAVORITE_URL, () => HttpResponse.json({ favorited: false, favoriteCount: 0 })));
      const { result, queryClient } = setup({ detail: makeSkill({ isFavorited: true, favoriteCount: 0 }) });

      await act(async () => {
        await result.current.mutateAsync({ favorited: false });
      });

      expect(detailOf(queryClient)?.favoriteCount).toBe(0);
    });

    it('leaves the count alone when unfavoriting something that was not favorited', async () => {
      server.use(http.delete(FAVORITE_URL, () => HttpResponse.json({ favorited: false, favoriteCount: 5 })));
      const { result, queryClient } = setup({ detail: makeSkill({ isFavorited: false, favoriteCount: 5 }) });

      await act(async () => {
        await result.current.mutateAsync({ favorited: false });
      });

      expect(detailOf(queryClient)?.favoriteCount).toBe(5);
    });

    it('treats a missing count as zero', async () => {
      const { result, queryClient } = setup({ detail: makeSkill({ favoriteCount: undefined }) });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));

      await waitFor(() => expect(detailOf(queryClient)?.favoriteCount).toBe(1));

      await release();
    });
  });

  describe('when the server rejects the toggle', () => {
    it('puts the detail cache back the way it was', async () => {
      server.use(http.put(FAVORITE_URL, () => new HttpResponse(null, { status: 500 })));
      const before = makeSkill({ isFavorited: false, favoriteCount: 4 });
      const { result, queryClient } = setup({ detail: before });

      await act(async () => {
        await result.current.mutateAsync({ favorited: true }).catch(() => {});
      });

      await waitFor(() => expect(detailOf(queryClient)).toEqual(before));
    });

    it('puts every list cache back the way it was', async () => {
      server.use(http.put(FAVORITE_URL, () => new HttpResponse(null, { status: 500 })));
      const before = makeList([makeSkill({ favoriteCount: 4 })]);
      const { result, queryClient } = setup({ lists: { all: before } });

      await act(async () => {
        await result.current.mutateAsync({ favorited: true }).catch(() => {});
      });

      await waitFor(() => expect(listOf(queryClient)).toEqual(before));
    });

    it('reports the failure to the caller', async () => {
      server.use(http.put(FAVORITE_URL, () => new HttpResponse(null, { status: 500 })));
      const { result } = setup({ detail: makeSkill() });

      await act(async () => {
        await result.current.mutateAsync({ favorited: true }).catch(() => {});
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('once the toggle settles', () => {
    it('re-reads the detail and the lists from the server', async () => {
      server.use(http.put(FAVORITE_URL, () => HttpResponse.json({ favorited: true, favoriteCount: 1 })));
      const { result, queryClient } = setup({ detail: makeSkill(), lists: { all: makeList([makeSkill()]) } });

      await act(async () => {
        await result.current.mutateAsync({ favorited: true });
      });

      await waitFor(() => {
        expect(queryClient.getQueryState(['stored-skill', SKILL_ID])?.isInvalidated).toBe(true);
        expect(queryClient.getQueryState(['stored-skills', 'all'])?.isInvalidated).toBe(true);
      });
    });
  });

  describe('when the hook has no skill id', () => {
    it('refuses to send anything', async () => {
      let requested = false;
      server.use(
        http.put(`${BASE_URL}/api/stored/skills/:id/favorite`, () => {
          requested = true;
          return HttpResponse.json({ favorited: true, favoriteCount: 1 });
        }),
      );
      const { result } = setup({ omitSkillId: true });

      let thrown: unknown;
      await act(async () => {
        await result.current.mutateAsync({ favorited: true }).catch((error: unknown) => {
          thrown = error;
        });
      });

      expect((thrown as Error)?.message).toContain('skillId is required');
      expect(requested).toBe(false);
    });

    it('leaves the caches untouched', async () => {
      const before = makeList([makeSkill()]);
      const { result, queryClient } = setup({ omitSkillId: true, lists: { all: before } });
      // React Query keeps the same object for an equal value, so identity
      // cannot tell "never written" from "rewritten identically" — the write
      // timestamp can.
      const writtenAt = queryClient.getQueryState(['stored-skills', 'all'])?.dataUpdatedAt;

      await act(async () => {
        await result.current.mutateAsync({ favorited: true }).catch(() => {});
      });

      expect(listOf(queryClient)).toEqual(before);
      expect(queryClient.getQueryState(['stored-skills', 'all'])?.dataUpdatedAt).toBe(writtenAt);
    });
  });

  describe('when the detail cache is empty', () => {
    it('does not invent a detail entry from the optimistic update', async () => {
      const { result, queryClient } = setup({});
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));
      await release();

      expect(queryClient.getQueryData(['stored-skill', SKILL_ID])).toBeUndefined();
    });
  });

  describe('the work it cancels before patching', () => {
    it('keeps the optimistic patch even though a list refetch was already in flight', async () => {
      let releaseList: () => void = () => {};
      const listInFlight = new Promise<void>(resolve => {
        releaseList = resolve;
      });
      server.use(
        http.get(`${BASE_URL}/api/stored/skills`, async () => {
          await listInFlight;
          return HttpResponse.json(makeList([makeSkill({ favoriteCount: 0, isFavorited: false })]));
        }),
      );

      const { result, queryClient } = setup({ lists: { all: makeList([makeSkill()]) } });
      // Put a refetch of the list in flight, then toggle underneath it.
      void queryClient.fetchQuery({
        queryKey: ['stored-skills', 'all'],
        queryFn: async () => {
          const response = await fetch(`${BASE_URL}/api/stored/skills`);
          return (await response.json()) as ListStoredSkillsResponse;
        },
      });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));
      await waitFor(() => expect(listOf(queryClient)?.skills[0].isFavorited).toBe(true));

      await act(async () => releaseList());
      await release();

      // Without the cancel, the stale in-flight response would land on top of
      // the optimistic patch and flip the star back off.
      expect(listOf(queryClient)?.skills[0].isFavorited).toBe(true);
    });

    it('cancels an in-flight read of the skill itself, not just the lists', async () => {
      let releaseDetail: () => void = () => {};
      const detailInFlight = new Promise<void>(resolve => {
        releaseDetail = resolve;
      });
      server.use(
        http.get(`${BASE_URL}/api/stored/skills/${SKILL_ID}`, async () => {
          await detailInFlight;
          return HttpResponse.json(makeSkill({ isFavorited: false, favoriteCount: 0 }));
        }),
      );

      const { result, queryClient } = setup({ detail: makeSkill() });
      void queryClient.fetchQuery({
        queryKey: ['stored-skill', SKILL_ID],
        queryFn: async () => {
          const response = await fetch(`${BASE_URL}/api/stored/skills/${SKILL_ID}`);
          return (await response.json()) as StoredSkillResponse;
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
      const { result, queryClient } = setup({ lists: { all: makeList([makeSkill()]) } });
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

      const { result, queryClient } = setup({ detail: makeSkill() });
      const other = queryClient.fetchQuery({
        queryKey: ['stored-workflows'],
        queryFn: async () => {
          await otherInFlight;
          return { ok: true };
        },
      });
      const release = pendingFavorite();

      act(() => result.current.mutate({ favorited: true }));
      await act(async () => releaseOther());
      await release();

      await expect(other).resolves.toEqual({ ok: true });
    });
  });

  describe('the caches it refreshes once the toggle settles', () => {
    it('leaves unrelated caches alone', async () => {
      server.use(http.put(FAVORITE_URL, () => HttpResponse.json({ favorited: true, favoriteCount: 1 })));
      const { result, queryClient } = setup({ detail: makeSkill() });
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
      const { result, queryClient } = setup({ lists: { all: makeList([makeSkill()]) } });

      await act(async () => {
        await result.current.mutateAsync({ favorited: true }).catch(() => {});
      });

      expect(queryClient.getQueryCache().find({ queryKey: ['stored-skill', SKILL_ID] })).toBeUndefined();
    });

    it('does not invent cache entries while rolling the lists back', async () => {
      server.use(http.put(FAVORITE_URL, () => new HttpResponse(null, { status: 500 })));
      const { result, queryClient } = setup({ lists: { all: makeList([makeSkill()]) } });
      const before = queryClient.getQueryCache().getAll().length;

      await act(async () => {
        await result.current.mutateAsync({ favorited: true }).catch(() => {});
      });

      expect(queryClient.getQueryCache().getAll()).toHaveLength(before);
    });
  });
});
