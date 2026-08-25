import { usePlaygroundStore } from '@mastra/playground-ui/store/playground-store';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useCloneThread,
  useDeleteThread,
  useMemory,
  useMemoryConfig,
  useMemorySearch,
  useMemoryWithOMStatus,
  useObservationalMemory,
  useThread,
  useThreads,
} from '../use-memory';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';
const THREAD_ID = 'thread-1';
const RESOURCE_ID = 'resource-1';

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

type Seen = { method: string; path: string; search: string };

/** Records every request that reaches the memory endpoints. */
const captureMemory = (body: unknown = {}) => {
  const seen: Seen[] = [];
  const record = ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    seen.push({ method: request.method, path: url.pathname, search: url.search });
    return HttpResponse.json(body);
  };

  server.use(
    http.get(`${BASE_URL}/api/memory/*`, record),
    http.post(`${BASE_URL}/api/memory/*`, record),
    http.delete(`${BASE_URL}/api/memory/*`, record),
  );
  return seen;
};

/**
 * `retry` defaults to off so unrelated specs stay fast. The no-retry
 * assertions pass `retry: true` instead, so what they observe is each hook's
 * own `retry: false` rather than the client default masking it.
 */
const setup = ({ retry = false }: { retry?: boolean } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  return { wrapper, queryClient };
};

/** Lets react-query settle so "no request was made" is a real observation. */
const settle = () => act(async () => new Promise(resolve => setTimeout(resolve, 60)));

beforeEach(() => usePlaygroundStore.setState({ requestContext: {} }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useMemory', () => {
  it('reads the memory status of an agent', async () => {
    const seen = captureMemory({ result: true });
    const { wrapper } = setup();

    const { result } = renderHook(() => useMemory(AGENT_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0].path).toBe('/api/memory/status');
    expect(seen[0].search).toContain(`agentId=${AGENT_ID}`);
  });

  it('stays idle without an agent', async () => {
    const seen = captureMemory();
    const { wrapper } = setup();

    const { result } = renderHook(() => useMemory(), { wrapper });

    await settle();
    expect(seen).toEqual([]);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('surfaces a failure instead of retrying it away', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}/api/memory/status`, () => {
        calls += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const { wrapper } = setup();

    const { result } = renderHook(() => useMemory(AGENT_ID), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const afterFailure = calls;
    await settle();
    expect(calls).toBe(afterFailure);
  });

  it('keeps each agent in its own cache entry', async () => {
    captureMemory({ result: true });
    const { wrapper, queryClient } = setup();

    const { result } = renderHook(() => useMemory(AGENT_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['memory', AGENT_ID, {}])).toBeDefined();
    expect(queryClient.getQueryData(['memory', 'agent-2', {}])).toBeUndefined();
  });
});

describe('useMemoryConfig', () => {
  it('reads the memory config of an agent', async () => {
    const seen = captureMemory({ config: {} });
    const { wrapper } = setup();

    const { result } = renderHook(() => useMemoryConfig(AGENT_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0].path).toBe('/api/memory/config');
    expect(seen[0].search).toContain(`agentId=${AGENT_ID}`);
  });

  it('stays idle without an agent', async () => {
    const seen = captureMemory();
    const { wrapper } = setup();

    renderHook(() => useMemoryConfig(), { wrapper });

    await settle();
    expect(seen).toEqual([]);
  });

  it('keeps its cache entry apart from the memory status one', async () => {
    captureMemory({ config: {} });
    const { wrapper, queryClient } = setup();

    const { result } = renderHook(() => useMemoryConfig(AGENT_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['memory', 'config', AGENT_ID, {}])).toBeDefined();
    expect(queryClient.getQueryData(['memory', AGENT_ID, {}])).toBeUndefined();
  });
});

describe('useThread', () => {
  it('reads one thread', async () => {
    const seen = captureMemory({ id: THREAD_ID });
    const { wrapper } = setup();

    const { result } = renderHook(() => useThread({ threadId: THREAD_ID, agentId: AGENT_ID }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0].path).toBe(`/api/memory/threads/${THREAD_ID}`);
  });

  it.each([
    ['no thread', { agentId: AGENT_ID }],
    ['no agent', { threadId: THREAD_ID }],
    ['a thread that has not been created yet', { threadId: 'new', agentId: AGENT_ID }],
  ])('stays idle with %s', async (_label, args) => {
    const seen = captureMemory();
    const { wrapper } = setup();

    const { result } = renderHook(() => useThread(args), { wrapper });

    await settle();
    expect(seen).toEqual([]);
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useThreads', () => {
  it('lists the threads of a resource, unwrapped for the caller', async () => {
    const seen = captureMemory({ threads: [{ id: 't-1' }, { id: 't-2' }] });
    const { wrapper } = setup();

    const { result } = renderHook(
      () => useThreads({ resourceId: RESOURCE_ID, agentId: AGENT_ID, isMemoryEnabled: true }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(seen[0].path).toBe('/api/memory/threads');
    expect(seen[0].search).toContain(`resourceId=${RESOURCE_ID}`);
  });

  it('stays idle when the agent has memory switched off', async () => {
    const seen = captureMemory({ threads: [] });
    const { wrapper } = setup();

    const { result } = renderHook(
      () => useThreads({ resourceId: RESOURCE_ID, agentId: AGENT_ID, isMemoryEnabled: false }),
      { wrapper },
    );

    await settle();
    expect(seen).toEqual([]);
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useDeleteThread', () => {
  it('deletes the thread and tells the user', async () => {
    const seen = captureMemory({ result: 'ok' });
    const { wrapper } = setup();

    const { result } = renderHook(() => useDeleteThread(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ threadId: THREAD_ID, agentId: AGENT_ID });
    });

    expect(seen[0]).toMatchObject({ method: 'DELETE', path: `/api/memory/threads/${THREAD_ID}` });
    expect(toastSuccess).toHaveBeenCalledWith('Chat deleted successfully');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('refreshes the thread list of that agent', async () => {
    captureMemory({ result: 'ok' });
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(['memory', 'threads', AGENT_ID, AGENT_ID], { seeded: true });
    queryClient.setQueryData(['memory', 'threads', 'agent-2', 'agent-2'], { seeded: true });

    const { result } = renderHook(() => useDeleteThread(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ threadId: THREAD_ID, agentId: AGENT_ID });
    });

    expect(queryClient.getQueryState(['memory', 'threads', AGENT_ID, AGENT_ID])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['memory', 'threads', 'agent-2', 'agent-2'])?.isInvalidated).toBe(false);
  });

  it('tells the user when the delete fails', async () => {
    server.use(http.delete(`${BASE_URL}/api/memory/threads/*`, () => new HttpResponse(null, { status: 500 })));
    const { wrapper } = setup();

    const { result } = renderHook(() => useDeleteThread(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ threadId: THREAD_ID, agentId: AGENT_ID }).catch(() => {});
    });

    expect(toastError).toHaveBeenCalledWith('Failed to delete chat');
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

describe('useCloneThread', () => {
  it('clones the thread and tells the user', async () => {
    const seen = captureMemory({ id: 'thread-2' });
    const { wrapper } = setup();

    const { result } = renderHook(() => useCloneThread(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ threadId: THREAD_ID, agentId: AGENT_ID, title: 'A copy' });
    });

    expect(seen[0]).toMatchObject({ method: 'POST', path: `/api/memory/threads/${THREAD_ID}/clone` });
    expect(toastSuccess).toHaveBeenCalledWith('Thread cloned successfully');
  });

  it('refreshes the thread list of that agent', async () => {
    captureMemory({ id: 'thread-2' });
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(['memory', 'threads', AGENT_ID, AGENT_ID], { seeded: true });

    const { result } = renderHook(() => useCloneThread(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ threadId: THREAD_ID, agentId: AGENT_ID });
    });

    expect(queryClient.getQueryState(['memory', 'threads', AGENT_ID, AGENT_ID])?.isInvalidated).toBe(true);
  });

  it('tells the user when the clone fails', async () => {
    server.use(http.post(`${BASE_URL}/api/memory/threads/*`, () => new HttpResponse(null, { status: 500 })));
    const { wrapper } = setup();

    const { result } = renderHook(() => useCloneThread(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ threadId: THREAD_ID, agentId: AGENT_ID }).catch(() => {});
    });

    expect(toastError).toHaveBeenCalledWith('Failed to clone thread');
  });
});

describe('useMemorySearch', () => {
  it('searches within the thread the caller named', async () => {
    const seen = captureMemory({ results: [] });
    const { wrapper } = setup();

    const { result } = renderHook(
      () => useMemorySearch({ agentId: AGENT_ID, resourceId: RESOURCE_ID, threadId: THREAD_ID }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync({ searchQuery: 'invoices' });
    });

    expect(seen[0].path).toBe('/api/memory/search');
    expect(seen[0].search).toContain('searchQuery=invoices');
    expect(seen[0].search).toContain(`threadId=${THREAD_ID}`);
  });

  it('searches across the whole resource when no thread is named', async () => {
    const seen = captureMemory({ results: [] });
    const { wrapper } = setup();

    const { result } = renderHook(() => useMemorySearch({ agentId: AGENT_ID, resourceId: RESOURCE_ID }), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ searchQuery: 'invoices' });
    });

    expect(seen[0].search).not.toContain('threadId=');
  });
});

describe('useObservationalMemory', () => {
  const OM_URL = `${BASE_URL}/api/memory/observational-memory`;

  it('reads the observations recorded for a resource', async () => {
    const seen = captureMemory({ current: null, history: [] });
    const { wrapper } = setup();

    const { result } = renderHook(() => useObservationalMemory({ agentId: AGENT_ID, resourceId: RESOURCE_ID }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0].path).toBe('/api/memory/observational-memory');
    expect(seen[0].search).toContain(`resourceId=${RESOURCE_ID}`);
  });

  it('reads them for a thread when no resource is named', async () => {
    const seen = captureMemory({ current: null, history: [] });
    const { wrapper } = setup();

    const { result } = renderHook(() => useObservationalMemory({ agentId: AGENT_ID, threadId: THREAD_ID }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0].search).toContain(`threadId=${THREAD_ID}`);
  });

  describe('when there is nothing to read', () => {
    it.each([
      ['neither a resource nor a thread', { agentId: AGENT_ID }],
      ['no agent', { agentId: '', resourceId: RESOURCE_ID }],
      ['the caller disabled it', { agentId: AGENT_ID, resourceId: RESOURCE_ID, enabled: false }],
    ])('stays idle with %s', async (_label, args) => {
      const seen = captureMemory();
      const { wrapper } = setup();

      const { result } = renderHook(() => useObservationalMemory(args), { wrapper });

      await settle();
      expect(seen).toEqual([]);
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  it('polls while observation is in progress', async () => {
    let calls = 0;
    server.use(
      http.get(OM_URL, () => {
        calls += 1;
        return HttpResponse.json({ current: null, history: [] });
      }),
    );
    const { wrapper } = setup();

    const { result } = renderHook(
      () => useObservationalMemory({ agentId: AGENT_ID, resourceId: RESOURCE_ID, isActive: true }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(calls).toBeGreaterThan(1), { timeout: 5000 });
  });

  it('does not poll while nothing is in progress', async () => {
    let calls = 0;
    server.use(
      http.get(OM_URL, () => {
        calls += 1;
        return HttpResponse.json({ current: null, history: [] });
      }),
    );
    const { wrapper } = setup();

    const { result } = renderHook(() => useObservationalMemory({ agentId: AGENT_ID, resourceId: RESOURCE_ID }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const afterFirst = calls;
    await act(async () => new Promise(resolve => setTimeout(resolve, 2500)));
    expect(calls).toBe(afterFirst);
  });
});

describe('useMemoryWithOMStatus', () => {
  const STATUS_URL = `${BASE_URL}/api/memory/status`;

  it('reads the status scoped to the resource and thread', async () => {
    const seen = captureMemory({ result: true });
    const { wrapper } = setup();

    const { result } = renderHook(
      () => useMemoryWithOMStatus({ agentId: AGENT_ID, resourceId: RESOURCE_ID, threadId: THREAD_ID }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0].search).toContain(`resourceId=${RESOURCE_ID}`);
    expect(seen[0].search).toContain(`threadId=${THREAD_ID}`);
  });

  it('stays idle without an agent', async () => {
    const seen = captureMemory();
    const { wrapper } = setup();

    const { result } = renderHook(() => useMemoryWithOMStatus({}), { wrapper });

    await settle();
    expect(seen).toEqual([]);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it.each([['isObserving'], ['isReflecting']])('starts polling once the server reports %s', async flag => {
    let calls = 0;
    server.use(
      http.get(STATUS_URL, () => {
        calls += 1;
        return HttpResponse.json({ result: true, observationalMemory: { [flag]: true } });
      }),
    );
    const { wrapper } = setup();

    const { result } = renderHook(() => useMemoryWithOMStatus({ agentId: AGENT_ID }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(calls).toBeGreaterThan(1), { timeout: 5000 });
  });

  it('does not poll while nothing is in progress', async () => {
    let calls = 0;
    server.use(
      http.get(STATUS_URL, () => {
        calls += 1;
        return HttpResponse.json({ result: true, observationalMemory: { isObserving: false, isReflecting: false } });
      }),
    );
    const { wrapper } = setup();

    const { result } = renderHook(() => useMemoryWithOMStatus({ agentId: AGENT_ID }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const afterFirst = calls;
    await act(async () => new Promise(resolve => setTimeout(resolve, 2500)));
    expect(calls).toBe(afterFirst);
  });

  it('honours a caller that opted out of polling', async () => {
    let calls = 0;
    server.use(
      http.get(STATUS_URL, () => {
        calls += 1;
        return HttpResponse.json({ result: true, observationalMemory: { isObserving: true } });
      }),
    );
    const { wrapper } = setup();

    const { result } = renderHook(() => useMemoryWithOMStatus({ agentId: AGENT_ID, pollWhenActive: false }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const afterFirst = calls;
    await act(async () => new Promise(resolve => setTimeout(resolve, 2500)));
    expect(calls).toBe(afterFirst);
  });

  it('keeps its cache entry apart from the plain memory status one', async () => {
    captureMemory({ result: true });
    const { wrapper, queryClient } = setup();

    const { result } = renderHook(() => useMemoryWithOMStatus({ agentId: AGENT_ID }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['memory-status', AGENT_ID, undefined, undefined, {}])).toBeDefined();
    expect(queryClient.getQueryData(['memory', AGENT_ID, {}])).toBeUndefined();
  });
});

describe('the request context the studio is scoped to', () => {
  it('travels with a memory read and keys its cache entry', async () => {
    usePlaygroundStore.setState({ requestContext: { tenant: 'acme' } });
    const seen = captureMemory({ result: true });
    const { wrapper, queryClient } = setup();

    const { result } = renderHook(() => useMemory(AGENT_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0].search).toContain(`requestContext=${encodeURIComponent(btoa(JSON.stringify({ tenant: 'acme' })))}`);
    expect(queryClient.getQueryData(['memory', AGENT_ID, { tenant: 'acme' }])).toBeDefined();
  });
});

/**
 * The memory reads are cached for five minutes and kept for ten. Both windows
 * are only observable by unmounting and coming back: a window measured in
 * fractions of a millisecond would have expired, so the second mount would go
 * back to the server.
 */
describe('the windows the memory reads are cached for', () => {
  const remountCases = [
    ['the memory status', '/api/memory/status', () => useMemory(AGENT_ID)],
    ['the memory config', '/api/memory/config', () => useMemoryConfig(AGENT_ID)],
    [
      'a single thread',
      `/api/memory/threads/${THREAD_ID}`,
      () => useThread({ threadId: THREAD_ID, agentId: AGENT_ID }),
    ],
  ] as const;

  it.each(remountCases)('serves a remount of %s from cache', async (_label, path, useHook) => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}${path}`, () => {
        calls += 1;
        return HttpResponse.json({ result: true, id: THREAD_ID });
      }),
    );
    const { wrapper } = setup();

    const first = renderHook(useHook, { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    await act(async () => new Promise(resolve => setTimeout(resolve, 80)));

    const second = renderHook(useHook, { wrapper });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    expect(calls).toBe(1);
  });

  it.each(remountCases)('does not re-read %s when the window regains focus', async (_label, path, useHook) => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}${path}`, () => {
        calls += 1;
        return HttpResponse.json({ result: true, id: THREAD_ID });
      }),
    );
    const { wrapper } = setup();

    const { result } = renderHook(useHook, { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await new Promise(resolve => setTimeout(resolve, 80));
    });

    expect(calls).toBe(1);
  });

  it.each(remountCases)('surfaces a failure of %s without starting the request over', async (_label, path, useHook) => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}${path}`, () => {
        calls += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const { wrapper } = setup({ retry: true });

    const { result } = renderHook(useHook, { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const afterFirstFailure = calls;

    await act(async () => new Promise(resolve => setTimeout(resolve, 1500)));

    expect(calls).toBe(afterFirstFailure);
  });
});

describe('the observational memory views, while they refresh', () => {
  const OM_URL = `${BASE_URL}/api/memory/observational-memory`;
  const STATUS_URL = `${BASE_URL}/api/memory/status`;

  it('keeps showing the observations it already has, so the panel does not flash empty', async () => {
    let calls = 0;
    server.use(
      http.get(OM_URL, async () => {
        calls += 1;
        if (calls > 1) await new Promise(resolve => setTimeout(resolve, 120));
        return HttpResponse.json({ current: { id: `om-${calls}` }, history: [] });
      }),
    );
    const { wrapper, queryClient } = setup();

    const { result } = renderHook(() => useObservationalMemory({ agentId: AGENT_ID, resourceId: RESOURCE_ID }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.data).toMatchObject({ current: { id: 'om-1' } }));

    await act(async () => {
      void queryClient.refetchQueries({ queryKey: ['observational-memory'] });
      await new Promise(resolve => setTimeout(resolve, 40));
    });

    expect(result.current.data).toMatchObject({ current: { id: 'om-1' } });
  });

  it('keeps showing the status it already has while a refresh is in flight', async () => {
    let calls = 0;
    server.use(
      http.get(STATUS_URL, async () => {
        calls += 1;
        if (calls > 1) await new Promise(resolve => setTimeout(resolve, 120));
        return HttpResponse.json({ result: true, threads: calls });
      }),
    );
    const { wrapper, queryClient } = setup();

    const { result } = renderHook(() => useMemoryWithOMStatus({ agentId: AGENT_ID }), { wrapper });
    await waitFor(() => expect(result.current.data).toMatchObject({ threads: 1 }));

    await act(async () => {
      void queryClient.refetchQueries({ queryKey: ['memory-status'] });
      await new Promise(resolve => setTimeout(resolve, 40));
    });

    expect(result.current.data).toMatchObject({ threads: 1 });
  });
});
