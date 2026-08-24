import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useWorkflowSchema } from '../use-workflow-schema';
import { makeWorkflowDetails } from './fixtures/workflow-schema';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

/** Let react-query settle so "no request was made" is a real observation. */
const settle = () => new Promise(resolve => setTimeout(resolve, 50));

/**
 * Waited out *before* the second mount: any stale window measured in
 * milliseconds would have expired by then, so a remount would refetch. The
 * five-minute window must still serve from cache.
 */
const waitOutAShortStaleWindow = () => new Promise(resolve => setTimeout(resolve, 250));

describe('useWorkflowSchema', () => {
  describe('when the workflow declares both schemas', () => {
    it('exposes the parsed input and output schemas', async () => {
      server.use(http.get(`${BASE_URL}/api/workflows/summarize`, () => HttpResponse.json(makeWorkflowDetails())));

      const { result } = renderHook(() => useWorkflowSchema('summarize'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.inputSchema).toEqual({
        type: 'object',
        properties: { text: { type: 'string' } },
      });
      expect(result.current.data?.outputSchema).toEqual({
        type: 'object',
        properties: { summary: { type: 'string' } },
      });
    });
  });

  describe('when the workflow declares no schemas', () => {
    it('reports both as null', async () => {
      server.use(
        http.get(`${BASE_URL}/api/workflows/bare`, () =>
          HttpResponse.json(makeWorkflowDetails({ name: 'bare', inputSchema: '', outputSchema: '' })),
        ),
      );

      const { result } = renderHook(() => useWorkflowSchema('bare'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ inputSchema: null, outputSchema: null });
    });
  });

  describe('when no workflow is selected', () => {
    it('stays idle instead of fetching', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/workflows/:workflowId`, () => {
          onFetch();
          return HttpResponse.json(makeWorkflowDetails());
        }),
      );

      const { result } = renderHook(() => useWorkflowSchema(null), { wrapper: createWrapper() });

      await settle();
      expect(onFetch).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('when the selection changes between workflows', () => {
    it('keeps each workflow schema in its own cache entry', async () => {
      server.use(
        http.get(`${BASE_URL}/api/workflows/:workflowId`, ({ params }) =>
          HttpResponse.json(
            makeWorkflowDetails({
              inputSchema: JSON.stringify({ type: 'object', title: String(params.workflowId) }),
            }),
          ),
        ),
      );
      const wrapper = createWrapper();

      const first = renderHook(() => useWorkflowSchema('alpha'), { wrapper });
      await waitFor(() => expect(first.result.current.data?.inputSchema).toMatchObject({ title: 'alpha' }));

      const second = renderHook(() => useWorkflowSchema('beta'), { wrapper });
      await waitFor(() => expect(second.result.current.data?.inputSchema).toMatchObject({ title: 'beta' }));

      expect(first.result.current.data?.inputSchema).toMatchObject({ title: 'alpha' });
    });
  });

  describe('when the same workflow is read again within the stale window', () => {
    it('serves the cached schema without a second request', async () => {
      let calls = 0;
      server.use(
        http.get(`${BASE_URL}/api/workflows/summarize`, () => {
          calls += 1;
          return HttpResponse.json(makeWorkflowDetails());
        }),
      );
      const wrapper = createWrapper();

      const first = renderHook(() => useWorkflowSchema('summarize'), { wrapper });
      await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

      await waitOutAShortStaleWindow();

      const second = renderHook(() => useWorkflowSchema('summarize'), { wrapper });
      await settle();

      expect(second.result.current.isSuccess).toBe(true);
      expect(calls).toBe(1);
    });
  });
});
