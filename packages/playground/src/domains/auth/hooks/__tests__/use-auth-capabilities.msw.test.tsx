import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useAuthCapabilities } from '../use-auth-capabilities';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const CAPABILITIES_URL = `${BASE_URL}/api/auth/capabilities`;

const capabilities: AuthCapabilities = { enabled: false, login: null };

/**
 * `retry` defaults to off so unrelated specs stay fast. The retry assertions
 * pass `retry: true` instead, so what they observe is the hook's own
 * `retry: false` rather than the client default masking it.
 */
const makeWrapper = ({ retry = false }: { retry?: boolean } = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

/**
 * Waited out *before* the second mount: a stale window measured in
 * milliseconds would have expired by then, so a remount would refetch. The
 * one-minute window must still serve from cache.
 */
const waitOutAShortStaleWindow = () => new Promise(resolve => setTimeout(resolve, 250));

/** react-query's first retry lands ~1s after a failure. */
const settlePastFirstRetry = () => new Promise(resolve => setTimeout(resolve, 1500));

describe('useAuthCapabilities', () => {
  describe('when a second consumer mounts within the stale window', () => {
    it('serves the cached capabilities without a second request', async () => {
      let calls = 0;
      server.use(
        http.get(CAPABILITIES_URL, () => {
          calls += 1;
          return HttpResponse.json(capabilities);
        }),
      );
      const wrapper = makeWrapper();

      const first = renderHook(() => useAuthCapabilities(), { wrapper });
      await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

      await waitOutAShortStaleWindow();

      const second = renderHook(() => useAuthCapabilities(), { wrapper });
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(second.result.current.isSuccess).toBe(true);
      expect(calls).toBe(1);
    });
  });

  describe('when the capabilities endpoint fails', () => {
    it('surfaces the error without retrying the auth request', async () => {
      let calls = 0;
      server.use(
        http.get(CAPABILITIES_URL, () => {
          calls += 1;
          return new HttpResponse(null, { status: 500 });
        }),
      );

      const { result } = renderHook(() => useAuthCapabilities(), { wrapper: makeWrapper({ retry: true }) });

      await waitFor(() => expect(result.current.isError).toBe(true));
      await settlePastFirstRetry();
      expect(calls).toBe(1);
    });
  });
});
