// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';

import { useIsToolProviderAdmin } from '../use-is-tool-provider-admin';

import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const wrapper = ({ children }: PropsWithChildren) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

const withPermissions = (permissions: string[]) =>
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions }));

// Mirrors the server-side `hasAdminBypass(requestContext, 'tool-providers')`
// in packages/server/src/server/handlers/authorship.ts.
describe('useIsToolProviderAdmin', () => {
  it.each([['tool-providers:admin'], ['tool-providers:*'], ['*']])('is admin with the %s permission', async perm => {
    server.use(withPermissions([perm]));

    const { result } = renderHook(() => useIsToolProviderAdmin(), { wrapper });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('is not admin with unrelated or differently-scoped permissions', async () => {
    server.use(withPermissions(['agents:*', 'tool-providers:read']));

    const { result } = renderHook(() => useIsToolProviderAdmin(), { wrapper });

    // Give the /api/auth/me query time to resolve before the negative assert.
    await waitFor(() => expect(result.current).toBe(false));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(result.current).toBe(false);
  });

  it('is not admin when permissions are absent', async () => {
    server.use(http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester' })));

    const { result } = renderHook(() => useIsToolProviderAdmin(), { wrapper });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(result.current).toBe(false);
  });
});
