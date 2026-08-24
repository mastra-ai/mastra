import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useLogout, useSSOLogin } from '../use-auth-actions';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const makeHarness = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  return { wrapper, queryClient };
};

describe('useLogout', () => {
  describe('when the logout succeeds', () => {
    it('invalidates every auth cache so the UI re-gates', async () => {
      server.use(http.post(`${BASE_URL}/api/auth/logout`, () => HttpResponse.json({ success: true })));

      const { wrapper, queryClient } = makeHarness();
      queryClient.setQueryData(['auth', 'me'], { id: 'user-1' });
      queryClient.setQueryData(['auth', 'capabilities'], { enabled: true });
      queryClient.setQueryData(['stored-agents'], { agents: [] });

      const { result } = renderHook(() => useLogout(), { wrapper });
      await result.current.mutateAsync();

      await waitFor(() => expect(queryClient.getQueryState(['auth', 'me'])?.isInvalidated).toBe(true));
      expect(queryClient.getQueryState(['auth', 'capabilities'])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['stored-agents'])?.isInvalidated).toBe(false);
    });
  });

  describe('when the logout fails', () => {
    it('leaves the auth caches alone', async () => {
      server.use(http.post(`${BASE_URL}/api/auth/logout`, () => new HttpResponse(null, { status: 500 })));

      const { wrapper, queryClient } = makeHarness();
      queryClient.setQueryData(['auth', 'me'], { id: 'user-1' });

      const { result } = renderHook(() => useLogout(), { wrapper });
      await expect(result.current.mutateAsync()).rejects.toThrow();

      expect(queryClient.getQueryState(['auth', 'me'])?.isInvalidated).toBe(false);
    });
  });
});

describe('useSSOLogin', () => {
  describe('when the server hands back an identity-provider url', () => {
    it('exposes it so the caller can redirect', async () => {
      server.use(
        http.get(`${BASE_URL}/api/auth/sso/login`, () => HttpResponse.json({ url: 'https://sso.example.com/start' })),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useSSOLogin(), { wrapper });

      const response = await result.current.mutateAsync({});

      expect(response.url).toBe('https://sso.example.com/start');
    });

    it('passes the redirect target through', async () => {
      let receivedUrl: URL | undefined;
      server.use(
        http.get(`${BASE_URL}/api/auth/sso/login`, ({ request }) => {
          receivedUrl = new URL(request.url);
          return HttpResponse.json({ url: 'https://sso.example.com/start' });
        }),
      );

      const { wrapper } = makeHarness();
      const { result } = renderHook(() => useSSOLogin(), { wrapper });

      await result.current.mutateAsync({ redirectUri: 'http://localhost:4111/agents' });

      expect(receivedUrl?.searchParams.get('redirect_uri')).toBe('http://localhost:4111/agents');
    });
  });
});
