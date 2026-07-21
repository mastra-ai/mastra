/**
 * BDD coverage for the web-auth query hook and its runtime-config short-circuit.
 *
 * Drives the real `fetchAuthState` service + React Query cache; only the
 * network is mocked (MSW, `onUnhandledRequest: 'error'`). The injected
 * `window.__MASTRACODE_CONFIG__` flag comes from the server (prod) or Vite
 * (dev); tests set it directly on `window` the same way the injected script
 * would.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import { useWebAuth } from '../useWebAuth';

const AUTH_ME_URL = `${TEST_BASE_URL}/auth/me`;

afterEach(() => {
  delete window.__MASTRACODE_CONFIG__;
});

describe('useWebAuth', () => {
  describe('given the server injected authEnabled: false', () => {
    it('resolves the disabled state without touching the network', async () => {
      window.__MASTRACODE_CONFIG__ = { authEnabled: false };
      // No `/auth/me` handler registered: any fetch would trip MSW's
      // onUnhandledRequest: 'error' and fail this test.

      const { result, client } = renderHookWithProviders(() => useWebAuth());

      await waitFor(() => expect(result.current.data).toBeDefined());
      expect(result.current.data).toEqual({ authEnabled: false, authenticated: false });
      await waitFor(() => expect(client.isFetching()).toBe(0));
    });
  });

  describe('given the server injected authEnabled: true', () => {
    it('fetches /auth/me and exposes the signed-in identity', async () => {
      window.__MASTRACODE_CONFIG__ = { authEnabled: true };
      server.use(
        http.get(AUTH_ME_URL, () =>
          HttpResponse.json({ authenticated: true, user: { email: 'dev@mastra.ai', name: 'Dev' } }),
        ),
      );

      const { result } = renderHookWithProviders(() => useWebAuth());

      await waitFor(() => expect(result.current.data).toBeDefined());
      expect(result.current.data).toEqual({
        authEnabled: true,
        authenticated: true,
        user: { email: 'dev@mastra.ai', name: 'Dev' },
      });
    });

    it('reports unauthenticated when /auth/me returns 401', async () => {
      window.__MASTRACODE_CONFIG__ = { authEnabled: true };
      server.use(http.get(AUTH_ME_URL, () => HttpResponse.json({ error: 'unauthenticated' }, { status: 401 })));

      const { result } = renderHookWithProviders(() => useWebAuth());

      await waitFor(() => expect(result.current.data).toBeDefined());
      expect(result.current.data).toEqual({ authEnabled: true, authenticated: false });
    });
  });

  describe('given no injected runtime config (stale HTML, tests)', () => {
    it('falls back to probing /auth/me and degrades to auth disabled on 404', async () => {
      const hit = vi.fn();
      server.use(
        http.get(AUTH_ME_URL, () => {
          hit();
          return HttpResponse.json({ error: 'not_found' }, { status: 404 });
        }),
      );

      const { result } = renderHookWithProviders(() => useWebAuth());

      await waitFor(() => expect(result.current.data).toBeDefined());
      expect(result.current.data).toEqual({ authEnabled: false, authenticated: false });
      expect(hit).toHaveBeenCalledTimes(1);
    });
  });
});
