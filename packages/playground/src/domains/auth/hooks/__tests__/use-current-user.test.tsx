import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { useCurrentUser } from '../use-current-user';
import { server } from '@/test/msw-server';

/**
 * Guards the transient-vs-terminal retry contract for /api/auth/me.
 *
 * PLTFRM-1270: if the middleware returns 503 (transient WorkOS failure) we must
 * NOT flip to isError — that surfaces as a login redirect which fed the 429
 * lockout loop. 401 (terminal) must fail fast as before.
 */

const BASE_URL = 'http://localhost:4000';

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('useCurrentUser', () => {
  describe('when the server responds 200 with a user', () => {
    it('returns the user', async () => {
      server.use(http.get('*/api/auth/me', () => HttpResponse.json({ id: 'u_1', email: 'a@b.c', name: 'A' })));

      const { result } = renderHook(() => useCurrentUser(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toMatchObject({ id: 'u_1', email: 'a@b.c' });
    });
  });

  describe('when the server responds 401', () => {
    it('surfaces isError immediately (terminal)', async () => {
      server.use(http.get('*/api/auth/me', () => new HttpResponse(null, { status: 401 })));

      const { result } = renderHook(() => useCurrentUser(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.failureCount).toBe(1);
    });
  });

  describe('when the server responds 503 then 200', () => {
    it('retries and eventually returns the user without surfacing isError', async () => {
      let calls = 0;
      server.use(
        http.get('*/api/auth/me', () => {
          calls += 1;
          if (calls < 2) return new HttpResponse(null, { status: 503 });
          return HttpResponse.json({ id: 'u_1', email: 'a@b.c', name: 'A' });
        }),
      );

      const { result } = renderHook(() => useCurrentUser(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });
      expect(result.current.isError).toBe(false);
      expect(calls).toBeGreaterThanOrEqual(2);
    });
  });
});
