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
  describe('when the server keeps returning 503', () => {
    it('gives up after the transient retry budget', async () => {
      let calls = 0;
      server.use(
        http.get('*/api/auth/me', () => {
          calls += 1;
          return new HttpResponse(null, { status: 503 });
        }),
      );

      const { result } = renderHook(() => useCurrentUser(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 20000 });
      // One initial attempt plus three retries.
      expect(calls).toBe(4);
    }, 25000);
  });

  describe('when the request fails for a reason other than an HTTP status', () => {
    it('fails fast rather than burning the retry budget', async () => {
      let calls = 0;
      server.use(
        http.get('*/api/auth/me', () => {
          calls += 1;
          return HttpResponse.json('not-an-object-with-status', { status: 200 });
        }),
      );

      const { result } = renderHook(() => useCurrentUser(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(calls).toBe(1);
    });
  });

  describe('when the server responds 500', () => {
    it('fails fast, because only 503 is treated as transient', async () => {
      let calls = 0;
      server.use(
        http.get('*/api/auth/me', () => {
          calls += 1;
          return new HttpResponse(null, { status: 500 });
        }),
      );

      const { result } = renderHook(() => useCurrentUser(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(calls).toBe(1);
    });
  });

  describe('when the request never reaches the server', () => {
    it('fails fast, because only a status-carrying failure can be transient', async () => {
      let calls = 0;
      server.use(
        http.get('*/api/auth/me', () => {
          calls += 1;
          return HttpResponse.error();
        }),
      );

      const { result } = renderHook(() => useCurrentUser(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true));
      // A network error is not a CurrentUserError, so it must not consume the
      // transient budget reserved for a flapping auth provider.
      expect(calls).toBe(1);
    });
  });

  describe('the error it raises', () => {
    it('names the failing status so callers can branch on it', async () => {
      server.use(http.get('*/api/auth/me', () => new HttpResponse(null, { status: 401 })));

      const { result } = renderHook(() => useCurrentUser(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toMatchObject({ name: 'CurrentUserError', status: 401 });
      expect(result.current.error?.message).toBe('Failed to fetch current user: 401');
    });
  });

  describe('the request it sends', () => {
    it('asks the configured base url for the current user as JSON', async () => {
      let seen: Request | undefined;
      server.use(
        http.get('*/api/auth/me', ({ request }) => {
          seen = request;
          return HttpResponse.json({ id: 'u_1', email: 'a@b.c' });
        }),
      );

      const { result } = renderHook(() => useCurrentUser(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(seen?.url).toBe(`${BASE_URL}/api/auth/me`);
      expect(seen?.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('when a second consumer mounts within the stale window', () => {
    it('serves the cached user without a second request', async () => {
      let calls = 0;
      server.use(
        http.get('*/api/auth/me', () => {
          calls += 1;
          return HttpResponse.json({ id: 'u_1', email: 'a@b.c' });
        }),
      );
      const wrapper = makeWrapper();

      const first = renderHook(() => useCurrentUser(), { wrapper });
      await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

      // A stale window measured in milliseconds would have expired by now.
      await new Promise(resolve => setTimeout(resolve, 250));

      const second = renderHook(() => useCurrentUser(), { wrapper });
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(second.result.current.isSuccess).toBe(true);
      expect(calls).toBe(1);
    });
  });
});
