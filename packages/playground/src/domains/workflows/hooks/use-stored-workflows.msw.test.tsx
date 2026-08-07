import type {
  ListStoredWorkflowsResponse,
  StoredWorkflowDefinition,
  UpsertStoredWorkflowParams,
} from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  storedWorkflowKeys,
  useDeleteStoredWorkflow,
  useStoredWorkflow,
  useStoredWorkflows,
  useUpsertStoredWorkflow,
} from './use-stored-workflows';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const workflow: StoredWorkflowDefinition = {
  id: 'daily-summary',
  description: 'Summarizes the day',
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  graph: [{ type: 'tool', id: 'load-items', toolId: 'load-items' }],
  status: 'active',
  source: 'storage',
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:00:00.000Z',
};

const createHarness = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  return { queryClient, wrapper };
};

const upsertInput: UpsertStoredWorkflowParams = {
  id: workflow.id,
  inputSchema: workflow.inputSchema,
  outputSchema: workflow.outputSchema,
  graph: workflow.graph,
};

describe('stored workflow hooks', () => {
  describe('when active stored workflows exist', () => {
    it('lists definitions through the real client', async () => {
      const list: ListStoredWorkflowsResponse = { workflows: [workflow], total: 1 };
      server.use(
        http.get(`${BASE_URL}/api/stored/workflows`, ({ request }) => {
          expect(new URL(request.url).searchParams.get('status')).toBe('active');
          return HttpResponse.json(list);
        }),
      );
      const { wrapper } = createHarness();
      const listed = renderHook(() => useStoredWorkflows({ status: 'active' }), { wrapper });

      await waitFor(() => expect(listed.result.current.isSuccess).toBe(true));
      expect(listed.result.current.data).toEqual(list);
    });

    it('gets one definition through the real client', async () => {
      server.use(
        http.get(`${BASE_URL}/api/stored/workflows/:id`, ({ params }) => {
          expect(params.id).toBe(workflow.id);
          return HttpResponse.json(workflow);
        }),
      );
      const { wrapper } = createHarness();
      const detailed = renderHook(() => useStoredWorkflow(workflow.id), { wrapper });

      await waitFor(() => expect(detailed.result.current.isSuccess).toBe(true));
      expect(detailed.result.current.data).toEqual(workflow);
    });
  });

  describe('when a stored workflow is upserted', () => {
    it('invalidates persisted and runtime workflow caches', async () => {
      const runtimeRefetch = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/stored/workflows`, async ({ request }) => {
          expect(await request.json()).toMatchObject({ id: workflow.id });
          return HttpResponse.json({ ok: true as const, id: workflow.id });
        }),
        http.get(`${BASE_URL}/api/workflows`, () => {
          runtimeRefetch();
          return HttpResponse.json({});
        }),
      );
      const { queryClient, wrapper } = createHarness();
      queryClient.setQueryData(storedWorkflowKeys.lists(), { workflows: [], total: 0 });
      queryClient.setQueryData(['workflows', {}], { stale: true });
      const mutation = renderHook(() => useUpsertStoredWorkflow(), { wrapper });

      await act(async () => {
        await mutation.result.current.mutateAsync(upsertInput);
      });

      expect(queryClient.getQueryState(storedWorkflowKeys.lists())?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['workflows', {}])?.isInvalidated).toBe(true);
      expect(runtimeRefetch).not.toHaveBeenCalled();
    });
  });

  describe('when a stored workflow is deleted', () => {
    it('removes detail data and invalidates both cache families', async () => {
      server.use(
        http.delete(`${BASE_URL}/api/stored/workflows/:id`, () =>
          HttpResponse.json({ success: true as const, message: 'Deleted' }),
        ),
      );
      const { queryClient, wrapper } = createHarness();
      queryClient.setQueryData(storedWorkflowKeys.detail(workflow.id), workflow);
      queryClient.setQueryData(storedWorkflowKeys.lists(), { workflows: [workflow], total: 1 });
      queryClient.setQueryData(['workflows', {}], { [workflow.id]: {} });
      const mutation = renderHook(() => useDeleteStoredWorkflow(), { wrapper });

      await act(async () => {
        await mutation.result.current.mutateAsync(workflow.id);
      });

      expect(queryClient.getQueryData(storedWorkflowKeys.detail(workflow.id))).toBeUndefined();
      expect(queryClient.getQueryState(storedWorkflowKeys.lists())?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['workflows', {}])?.isInvalidated).toBe(true);
    });
  });

  describe('when a stored workflow upsert fails', () => {
    it('preserves cached definitions', async () => {
      server.use(
        http.post(`${BASE_URL}/api/stored/workflows`, () =>
          HttpResponse.json({ message: 'invalid graph' }, { status: 400 }),
        ),
      );
      const { queryClient, wrapper } = createHarness();
      const existing: ListStoredWorkflowsResponse = { workflows: [workflow], total: 1 };
      queryClient.setQueryData(storedWorkflowKeys.lists(), existing);
      const mutation = renderHook(() => useUpsertStoredWorkflow(), { wrapper });

      await act(async () => {
        await expect(mutation.result.current.mutateAsync(upsertInput)).rejects.toThrow('400');
      });

      expect(queryClient.getQueryData(storedWorkflowKeys.lists())).toEqual(existing);
    });
  });

  describe('when a stored workflow delete fails', () => {
    it('preserves cached detail data', async () => {
      server.use(
        http.delete(`${BASE_URL}/api/stored/workflows/:id`, () =>
          HttpResponse.json({ message: 'delete failed' }, { status: 500 }),
        ),
      );
      const { queryClient, wrapper } = createHarness();
      queryClient.setQueryData(storedWorkflowKeys.detail(workflow.id), workflow);
      const mutation = renderHook(() => useDeleteStoredWorkflow(), { wrapper });

      await act(async () => {
        await expect(mutation.result.current.mutateAsync(workflow.id)).rejects.toThrow('500');
      });

      expect(queryClient.getQueryData(storedWorkflowKeys.detail(workflow.id))).toEqual(workflow);
    });
  });
});
