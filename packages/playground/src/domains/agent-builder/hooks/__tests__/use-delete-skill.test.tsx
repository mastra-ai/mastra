// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDeleteSkill } from '../use-delete-skill';
import { makeStoredSkill } from './fixtures/stored-skills';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const makeHarness = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  return { queryClient, Wrapper };
};

describe('useDeleteSkill', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes the skill and invalidates the stored-skills list cache', async () => {
    const seenDelete = vi.fn();
    server.use(
      http.delete(`${BASE_URL}/api/stored/skills/skill-1`, () => {
        seenDelete();
        return HttpResponse.json({ success: true, message: 'deleted' });
      }),
    );

    const { queryClient, Wrapper } = makeHarness();
    queryClient.setQueryData(['stored-skills'], { skills: [makeStoredSkill()], total: 1 });
    queryClient.setQueryData(['stored-skill', 'skill-1'], makeStoredSkill());

    const { result } = renderHook(() => useDeleteSkill('skill-1'), { wrapper: Wrapper });

    await result.current.mutateAsync();

    await waitFor(() => expect(seenDelete).toHaveBeenCalledTimes(1));
    // List cache is invalidated (still present, but marked stale).
    expect(queryClient.getQueryState(['stored-skills'])?.isInvalidated).toBe(true);
    // The detail entry is removed entirely.
    expect(queryClient.getQueryData(['stored-skill', 'skill-1'])).toBeUndefined();
  });

  it('throws when no skillId is provided', async () => {
    const { Wrapper } = makeHarness();
    const { result } = renderHook(() => useDeleteSkill(undefined), { wrapper: Wrapper });

    await expect(result.current.mutateAsync()).rejects.toThrow(/skillId is required/);
  });
});
