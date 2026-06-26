import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';

import { useIsToolProviderAdmin } from '../use-is-tool-provider-admin';

import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  return { wrapper, queryClient };
};

// Waits for the `useCurrentUser` query (queryKey ['auth', 'me']) to settle, so
// negative-path assertions run *after* the auth response resolves rather than
// racing it with an arbitrary sleep (which leaks a state update outside act).
const waitForAuthSettled = (queryClient: QueryClient) =>
  waitFor(() => expect(queryClient.getQueryState(['auth', 'me'])?.status).toBe('success'));

const withPermissions = (permissions: string[]) =>
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions }));

// Mirrors the server-side `hasAdminBypass(requestContext, 'tool-providers')`
// in packages/server/src/server/handlers/authorship.ts.
describe('useIsToolProviderAdmin', () => {
  it.each([['tool-providers:admin'], ['tool-providers:*'], ['*']])('is admin with the %s permission', async perm => {
    server.use(withPermissions([perm]));

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useIsToolProviderAdmin(), { wrapper });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('is not admin with unrelated or differently-scoped permissions', async () => {
    server.use(withPermissions(['agents:*', 'tool-providers:read']));

    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useIsToolProviderAdmin(), { wrapper });

    // Wait for the auth query to settle, then assert it never flips to admin.
    await waitForAuthSettled(queryClient);
    expect(result.current).toBe(false);
  });

  it('is not admin when permissions are absent', async () => {
    server.use(http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester' })));

    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useIsToolProviderAdmin(), { wrapper });

    await waitForAuthSettled(queryClient);
    expect(result.current).toBe(false);
  });
});
