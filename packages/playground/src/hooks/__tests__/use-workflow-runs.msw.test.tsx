import type { WorkflowRuns } from '@mastra/core/storage';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PER_PAGE, useDeleteWorkflowRun, useWorkflowRun, useWorkflowRuns } from '../use-workflow-runs';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const WORKFLOW_ID = 'nightly-sync';
const RUNS_URL = `${BASE_URL}/api/workflows/${WORKFLOW_ID}/runs`;

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const page = (runIds: string[]): WorkflowRuns =>
  ({ runs: runIds.map(runId => ({ runId, workflowName: WORKFLOW_ID })), total: runIds.length }) as WorkflowRuns;

const fullPage = (prefix: string) => page(Array.from({ length: PER_PAGE }, (_, i) => `${prefix}-${i}`));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  wrapper.queryClient = queryClient;
  return wrapper;
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useWorkflowRuns', () => {
  it('asks the server for one page at a time', async () => {
    const seen: string[] = [];
    server.use(
      http.get(RUNS_URL, ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json(page(['r-1']));
      }),
    );

    const { result } = renderHook(() => useWorkflowRuns(WORKFLOW_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0]).toContain(`limit=${PER_PAGE}`);
    expect(seen[0]).toContain('offset=0');
  });

  it('offsets the second page by a whole page rather than by one run', async () => {
    const seen: string[] = [];
    server.use(
      http.get(RUNS_URL, ({ request }) => {
        const url = new URL(request.url);
        seen.push(url.searchParams.get('offset') ?? '');
        return HttpResponse.json(seen.length === 1 ? fullPage('a') : page(['b-0']));
      }),
    );

    const { result } = renderHook(() => useWorkflowRuns(WORKFLOW_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(seen).toEqual(['0', String(PER_PAGE)]);
  });

  it('hands the caller a flat, de-duplicated list across pages', async () => {
    let call = 0;
    server.use(
      http.get(RUNS_URL, () => {
        call += 1;
        return HttpResponse.json(call === 1 ? fullPage('a') : page(['a-0', 'b-0']));
      }),
    );

    const { result } = renderHook(() => useWorkflowRuns(WORKFLOW_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data).toHaveLength(PER_PAGE + 1));
    expect(result.current.data?.at(-1)?.runId).toBe('b-0');
  });

  it('stops paging once a short page comes back', async () => {
    server.use(http.get(RUNS_URL, () => HttpResponse.json(page(['r-1']))));

    const { result } = renderHook(() => useWorkflowRuns(WORKFLOW_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('surfaces a failure instead of retrying it away', async () => {
    let calls = 0;
    server.use(
      http.get(RUNS_URL, () => {
        calls += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );

    const { result } = renderHook(() => useWorkflowRuns(WORKFLOW_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // The SDK has its own retry budget; react-query must not add another round.
    const afterFirstFailure = calls;
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(calls).toBe(afterFirstFailure);
  });

  describe('when the caller disables it', () => {
    it('does not touch the server', async () => {
      let requested = false;
      server.use(
        http.get(RUNS_URL, () => {
          requested = true;
          return HttpResponse.json(page([]));
        }),
      );

      const { result } = renderHook(() => useWorkflowRuns(WORKFLOW_ID, { enabled: false }), {
        wrapper: createWrapper(),
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(requested).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  it('hands back a ref for the end-of-list sentinel', () => {
    server.use(http.get(RUNS_URL, () => HttpResponse.json(page([]))));

    const { result } = renderHook(() => useWorkflowRuns(WORKFLOW_ID), { wrapper: createWrapper() });

    expect(typeof result.current.setEndOfListElement).toBe('function');
  });
});

describe('useWorkflowRun', () => {
  it('reads one run by its id', async () => {
    server.use(http.get(`${RUNS_URL}/run-7`, () => HttpResponse.json({ runId: 'run-7', workflowName: WORKFLOW_ID })));

    const { result } = renderHook(() => useWorkflowRun(WORKFLOW_ID, 'run-7'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toMatchObject({ runId: 'run-7' }));
  });

  it('keeps each run in its own cache entry', async () => {
    server.use(
      http.get(`${RUNS_URL}/:runId`, ({ params }) =>
        HttpResponse.json({ runId: params.runId, workflowName: WORKFLOW_ID }),
      ),
    );
    const wrapper = createWrapper();

    const first = renderHook(() => useWorkflowRun(WORKFLOW_ID, 'run-1'), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

    expect(wrapper.queryClient.getQueryData(['workflow-run', WORKFLOW_ID, 'run-1'])).toMatchObject({
      runId: 'run-1',
    });
  });

  describe('when either id is missing', () => {
    it.each([
      ['no workflow', '', 'run-1'],
      ['no run', WORKFLOW_ID, ''],
    ])('stays idle with %s', async (_label, workflowId, runId) => {
      let requested = false;
      server.use(
        http.get(`${BASE_URL}/api/workflows/:workflowId/runs/:runId`, () => {
          requested = true;
          return HttpResponse.json({});
        }),
      );

      const { result } = renderHook(() => useWorkflowRun(workflowId, runId), { wrapper: createWrapper() });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(requested).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('useDeleteWorkflowRun', () => {
  it('deletes the run and tells the user', async () => {
    let deleted: string | undefined;
    server.use(
      http.delete(`${RUNS_URL}/:runId`, ({ params }) => {
        deleted = String(params.runId);
        return HttpResponse.json({ message: 'ok' });
      }),
    );

    const { result } = renderHook(() => useDeleteWorkflowRun(WORKFLOW_ID), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ runId: 'run-3' });
    });

    expect(deleted).toBe('run-3');
    expect(toastSuccess).toHaveBeenCalledWith('Workflow run deleted successfully');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('re-reads the run list so the deleted row disappears', async () => {
    let listCalls = 0;
    server.use(
      http.get(RUNS_URL, () => {
        listCalls += 1;
        return HttpResponse.json(page(listCalls === 1 ? ['r-1'] : []));
      }),
      http.delete(`${RUNS_URL}/:runId`, () => HttpResponse.json({ message: 'ok' })),
    );
    const wrapper = createWrapper();

    const list = renderHook(() => useWorkflowRuns(WORKFLOW_ID), { wrapper });
    await waitFor(() => expect(list.result.current.data).toHaveLength(1));

    const { result } = renderHook(() => useDeleteWorkflowRun(WORKFLOW_ID), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ runId: 'r-1' });
    });

    await waitFor(() => expect(list.result.current.data).toHaveLength(0));
  });

  it('tells the user when the delete fails, and leaves the list alone', async () => {
    server.use(http.delete(`${RUNS_URL}/:runId`, () => new HttpResponse(null, { status: 500 })));
    const wrapper = createWrapper();

    const { result } = renderHook(() => useDeleteWorkflowRun(WORKFLOW_ID), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ runId: 'run-3' }).catch(() => {});
    });

    expect(toastError).toHaveBeenCalledWith('Failed to delete workflow run');
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
