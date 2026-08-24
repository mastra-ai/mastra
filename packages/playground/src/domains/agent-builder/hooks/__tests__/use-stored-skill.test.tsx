import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useStoredSkill } from '../use-stored-skill';
import { useToggleStoredSkillFavorite } from '../use-stored-skill-favorite';
import { makeStoredSkill } from './fixtures/stored-skills';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MastraReactProvider>
    );
  };
};

describe('useStoredSkill', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches stored skill details by id', async () => {
    const skill = makeStoredSkill({ id: 'skill-7', name: 'Renamed' });
    server.use(http.get(`${BASE_URL}/api/stored/skills/skill-7`, () => HttpResponse.json(skill)));

    const { result } = renderHook(() => useStoredSkill('skill-7'), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: 'skill-7', name: 'Renamed' });
  });

  it('does not fire the network request when skillId is undefined', async () => {
    const onFetch = vi.fn();
    server.use(
      http.get(`${BASE_URL}/api/stored/skills/:id`, () => {
        onFetch();
        return HttpResponse.json(makeStoredSkill());
      }),
    );

    const { result } = renderHook(() => useStoredSkill(undefined), { wrapper: makeWrapper() });

    // Give react-query a tick to decide whether to fire.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onFetch).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  describe('when two skills are read through the same cache', () => {
    it('keeps each skill in its own cache entry', async () => {
      server.use(
        http.get(`${BASE_URL}/api/stored/skills/skill-a`, () =>
          HttpResponse.json(makeStoredSkill({ id: 'skill-a', name: 'Alpha' })),
        ),
        http.get(`${BASE_URL}/api/stored/skills/skill-b`, () =>
          HttpResponse.json(makeStoredSkill({ id: 'skill-b', name: 'Beta' })),
        ),
      );
      const wrapper = makeWrapper();

      const alpha = renderHook(() => useStoredSkill('skill-a'), { wrapper });
      await waitFor(() => expect(alpha.result.current.data?.name).toBe('Alpha'));

      const beta = renderHook(() => useStoredSkill('skill-b'), { wrapper });
      await waitFor(() => expect(beta.result.current.data?.name).toBe('Beta'));

      expect(alpha.result.current.data?.name).toBe('Alpha');
    });
  });

  describe('when the skill is favorited while its details are on screen', () => {
    it('shows the optimistic favorite state through the same cache entry', async () => {
      server.use(
        http.get(`${BASE_URL}/api/stored/skills/skill-7`, () =>
          HttpResponse.json(makeStoredSkill({ id: 'skill-7', isFavorited: false, favoriteCount: 2 })),
        ),
        // Never settles, so the assertion observes the optimistic cache write
        // rather than the server response.
        http.put(`${BASE_URL}/api/stored/skills/skill-7/favorite`, () => new Promise<never>(() => {})),
      );
      const wrapper = makeWrapper();

      const details = renderHook(() => useStoredSkill('skill-7'), { wrapper });
      await waitFor(() => expect(details.result.current.isSuccess).toBe(true));

      const toggle = renderHook(() => useToggleStoredSkillFavorite('skill-7'), { wrapper });
      act(() => toggle.result.current.mutate({ favorited: true }));

      await waitFor(() => expect(details.result.current.data?.isFavorited).toBe(true));
      expect(details.result.current.data?.favoriteCount).toBe(3);
    });
  });
});
