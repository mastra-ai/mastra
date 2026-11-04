// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';
import { useWorkspaceInfo } from '../use-workspace';
import { useWorkspaceSkills } from '../use-workspace-skills';
import { BASE_URL, WORKSPACE_ID } from './fixtures/workspace';

vi.mock(import('../compatibility'), async importOriginal => ({
  ...(await importOriginal()),
  isWorkspaceV1Supported: () => false,
}));

const server = setupServer();
const hits: string[] = [];

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  server.use(
    http.all(`${BASE_URL}/*`, ({ request }) => {
      hits.push(request.url);
      return HttpResponse.json({});
    }),
  );
});
afterEach(() => {
  cleanup();
  hits.length = 0;
});
afterAll(() => server.close());

describe('when workspace v1 is not supported', () => {
  it('ignores a caller enabled: true on useWorkspaceInfo', () => {
    const { result } = renderHook(
      () => useWorkspaceInfo({ workspaceId: WORKSPACE_ID, queryOptions: { enabled: true } }),
      { wrapper: makeWrapper() },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(hits).toEqual([]);
  });

  it('ignores a caller enabled: true on useWorkspaceSkills', () => {
    const { result } = renderHook(
      () => useWorkspaceSkills({ workspaceId: WORKSPACE_ID, queryOptions: { enabled: true } }),
      { wrapper: makeWrapper() },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(hits).toEqual([]);
  });
});
