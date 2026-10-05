// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import { useThreads, useUpdateThread } from '../use-memory';
import { makeThread, makeThreadsResponse } from './fixtures/threads';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';
const THREAD_ID = 'thread-1';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

const useRenameHarness = () => ({
  threads: useThreads({ resourceId: AGENT_ID, agentId: AGENT_ID, isMemoryEnabled: true }),
  update: useUpdateThread(),
});

describe('useUpdateThread', () => {
  afterEach(() => {
    cleanup();
  });

  describe('when the server accepts the rename', () => {
    it('PATCHes the thread with the new title and agentId', async () => {
      const onPatch = vi.fn<(url: URL, body: unknown) => void>();
      server.use(
        http.patch(`${BASE_URL}/api/memory/threads/:threadId`, async ({ request }) => {
          const body = await request.json();
          onPatch(new URL(request.url), body);
          return HttpResponse.json(makeThread({ title: 'Renamed' }));
        }),
      );

      const { result } = renderHook(() => useUpdateThread(), { wrapper: makeWrapper() });

      await act(() => result.current.mutateAsync({ threadId: THREAD_ID, agentId: AGENT_ID, title: 'Renamed' }));

      const [url, body] = onPatch.mock.calls[0]!;
      expect(url.pathname).toBe(`/api/memory/threads/${THREAD_ID}`);
      expect(url.searchParams.get('agentId')).toBe(AGENT_ID);
      expect(body).toEqual({ title: 'Renamed' });
    });

    it('refetches the thread list', async () => {
      let title = 'Original title';
      server.use(
        http.get(`${BASE_URL}/api/memory/threads`, () =>
          HttpResponse.json(makeThreadsResponse([makeThread({ title })])),
        ),
        http.patch(`${BASE_URL}/api/memory/threads/:threadId`, () => {
          title = 'Renamed';
          return HttpResponse.json(makeThread({ title }));
        }),
      );

      const { result } = renderHook(useRenameHarness, { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.threads.data?.[0]?.title).toBe('Original title'));

      await act(() => result.current.update.mutateAsync({ threadId: THREAD_ID, agentId: AGENT_ID, title: 'Renamed' }));

      await waitFor(() => expect(result.current.threads.data?.[0]?.title).toBe('Renamed'));
    });
  });

  describe('when the server rejects the rename', () => {
    it('surfaces an error state', async () => {
      server.use(
        http.patch(`${BASE_URL}/api/memory/threads/:threadId`, () =>
          HttpResponse.json({ error: 'boom' }, { status: 500 }),
        ),
      );

      const { result } = renderHook(() => useUpdateThread(), { wrapper: makeWrapper() });

      act(() => result.current.mutate({ threadId: THREAD_ID, agentId: AGENT_ID, title: 'Renamed' }));

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
