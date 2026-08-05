import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useUpdateSkill } from '../use-update-skill';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const SKILL_ID = 'skill-update';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('useUpdateSkill', () => {
  beforeEach(() => {
    // The update mutation reads auth capabilities to gate workspace writes;
    // default to auth-disabled so permission checks pass without network noise.
    server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })));
  });

  afterEach(() => {
    cleanup();
  });

  it('sends a sparse PATCH body containing only the fields the caller specified', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${BASE_URL}/api/stored/skills/${SKILL_ID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: SKILL_ID, visibility: 'public' });
      }),
    );

    const { result } = renderHook(() => useUpdateSkill({ silent: true }), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ id: SKILL_ID, visibility: 'public' });
    });

    await waitFor(() => {
      expect(capturedBody).not.toBeNull();
    });

    // Only the keys the caller passed should be on the wire — never `undefined`
    // entries for name/description/instructions/files/license that would make
    // the server forward `undefined` into the storage driver.
    expect(capturedBody).toEqual({ visibility: 'public' });
    expect(Object.keys(capturedBody as unknown as Record<string, unknown>)).toEqual(['visibility']);
  });

  it('includes name and instructions only when the caller provides them', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${BASE_URL}/api/stored/skills/${SKILL_ID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: SKILL_ID });
      }),
    );

    const { result } = renderHook(() => useUpdateSkill({ silent: true }), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        id: SKILL_ID,
        name: 'My skill',
        instructions: 'Do the thing.',
      });
    });

    await waitFor(() => {
      expect(capturedBody).not.toBeNull();
    });

    expect(capturedBody).toEqual({ name: 'My skill', instructions: 'Do the thing.' });
  });
});
