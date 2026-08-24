import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { usePermissionPatterns } from '../use-permission-patterns';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const CAPABILITIES_URL = `${BASE_URL}/api/auth/capabilities`;
const PATTERNS_URL = `${BASE_URL}/api/auth/permission-patterns`;

const rbacOn: AuthCapabilities = {
  enabled: true,
  login: null,
  user: { id: 'user-1' },
  capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
  access: { roles: ['admin'], permissions: ['*'] },
};

const rbacOff: AuthCapabilities = {
  enabled: true,
  login: null,
  user: { id: 'user-1' },
  capabilities: { user: true, session: true, sso: false, rbac: false, acl: false },
  access: { roles: [], permissions: [] },
};

const authOff: AuthCapabilities = { enabled: false, login: null };

const makeHarness = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  return { wrapper, queryClient };
};

const settle = () => new Promise(resolve => setTimeout(resolve, 50));

/**
 * react-query's first retry lands ~1s after a failure, so a shorter wait cannot
 * tell "never retried" apart from "about to retry".
 */
const settlePastFirstRetry = () => new Promise(resolve => setTimeout(resolve, 1500));

describe('usePermissionPatterns', () => {
  describe('when RBAC is enabled', () => {
    it('exposes the server-owned pattern vocabulary', async () => {
      server.use(
        http.get(CAPABILITIES_URL, () => HttpResponse.json(rbacOn)),
        http.get(PATTERNS_URL, () => HttpResponse.json({ patterns: ['agents:read', 'agents:write'] })),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => usePermissionPatterns(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect([...result.current.patterns].sort()).toEqual(['agents:read', 'agents:write']);
    });

    it('reports an empty set when the server sends no patterns field', async () => {
      server.use(
        http.get(CAPABILITIES_URL, () => HttpResponse.json(rbacOn)),
        http.get(PATTERNS_URL, () => HttpResponse.json({})),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => usePermissionPatterns(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.patterns.size).toBe(0);
    });

    it('stays loading while the pattern request is still in flight', async () => {
      server.use(
        http.get(CAPABILITIES_URL, () => HttpResponse.json(rbacOn)),
        http.get(PATTERNS_URL, async () => {
          await delay(120);
          return HttpResponse.json({ patterns: ['agents:read'] });
        }),
      );

      const { wrapper, queryClient } = makeHarness();
      const { result } = renderHook(() => usePermissionPatterns(), { wrapper });

      // Capabilities have resolved, so any remaining loading is the pattern query.
      await waitFor(() => expect(queryClient.getQueryState(['auth', 'capabilities'])?.status).toBe('success'));
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it('surfaces a pattern-request failure without retrying', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(CAPABILITIES_URL, () => HttpResponse.json(rbacOn)),
        http.get(PATTERNS_URL, () => {
          onFetch();
          return new HttpResponse(null, { status: 403 });
        }),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => usePermissionPatterns(), { wrapper });

      await waitFor(() => expect(result.current.error).not.toBeNull());
      await settlePastFirstRetry();
      expect(onFetch).toHaveBeenCalledTimes(1);
      expect(result.current.patterns.size).toBe(0);
    });
  });

  describe.each([
    ['RBAC is not configured', rbacOff],
    ['auth is disabled entirely', authOff],
  ])('when %s', (_label, capabilities) => {
    it('never asks the server for the pattern vocabulary', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(CAPABILITIES_URL, () => HttpResponse.json(capabilities)),
        http.get(PATTERNS_URL, () => {
          onFetch();
          return HttpResponse.json({ patterns: ['agents:read'] });
        }),
      );

      const { wrapper, queryClient } = makeHarness();
      const { result } = renderHook(() => usePermissionPatterns(), { wrapper });

      await waitFor(() => expect(queryClient.getQueryState(['auth', 'capabilities'])?.status).toBe('success'));
      await settle();
      expect(onFetch).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.patterns.size).toBe(0);
    });
  });

  describe('while the capabilities are still resolving', () => {
    it('reports loading, because RBAC may still turn out to apply', async () => {
      server.use(
        http.get(CAPABILITIES_URL, async () => {
          await delay(80);
          return HttpResponse.json(rbacOff);
        }),
        http.get(PATTERNS_URL, () => HttpResponse.json({ patterns: [] })),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => usePermissionPatterns(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });
  });

  describe('when the capabilities request itself fails', () => {
    it('surfaces that error', async () => {
      server.use(
        http.get(CAPABILITIES_URL, () => new HttpResponse(null, { status: 500 })),
        http.get(PATTERNS_URL, () => HttpResponse.json({ patterns: [] })),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => usePermissionPatterns(), { wrapper });

      await waitFor(() => expect(result.current.error).not.toBeNull());
      expect(result.current.patterns.size).toBe(0);
    });
  });
});
