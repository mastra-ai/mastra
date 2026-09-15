import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useStoredSkill } from '../use-stored-skill';
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
});
