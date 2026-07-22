/**
 * BDD coverage for the Factory data hooks.
 *
 * Drives the real factory services + React Query cache; only the network is
 * mocked (MSW). Handlers register on the ApiConfig base URL the test providers
 * inject (`TEST_BASE_URL`), matching how the app wires it.
 */
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, renderWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import type { FactoryThreadTaskContext } from '../../api/types';
import type { GithubIssue, GithubPullRequest } from '../../../web/ui/domains/factory/services/factory';
import {
  useFactoryThreadTaskContextQuery,
  useProjectIssuesQuery,
  useProjectPullRequestsQuery,
} from '../useFactoryData';

afterEach(() => {
  vi.useRealTimers();
});

const PROJECT_ID = 'github-project-1';
const ISSUES_URL = `${TEST_BASE_URL}/web/github/projects/${PROJECT_ID}/issues`;
const PRS_URL = `${TEST_BASE_URL}/web/github/projects/${PROJECT_ID}/prs`;

const issues: GithubIssue[] = [
  {
    number: 12,
    title: 'Fix flaky test',
    url: 'https://github.com/mastra-ai/mastra/issues/12',
    author: 'ada',
    labels: ['bug'],
    comments: 3,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-02T00:00:00Z',
  },
];

const pullRequests: GithubPullRequest[] = [
  {
    number: 34,
    title: 'Add factory pages',
    url: 'https://github.com/mastra-ai/mastra/pull/34',
    author: 'grace',
    baseBranch: 'main',
    headBranch: 'feat/factory',
    createdAt: '2026-07-03T00:00:00Z',
    updatedAt: '2026-07-04T00:00:00Z',
  },
];

describe('useProjectIssuesQuery', () => {
  it('given the server returns issues, when the hook resolves, then it exposes them', async () => {
    server.use(http.get(ISSUES_URL, () => HttpResponse.json({ issues, nextPage: null })));

    const { result } = renderHookWithProviders(() => useProjectIssuesQuery(PROJECT_ID));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(issues);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('given more pages, when fetchNextPage is called, then pages accumulate in order', async () => {
    const pageTwoIssue: GithubIssue = { ...issues[0]!, number: 13, title: 'Page two issue' };
    const requestedPages: string[] = [];
    server.use(
      http.get(ISSUES_URL, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '1';
        requestedPages.push(page);
        return page === '1'
          ? HttpResponse.json({ issues, nextPage: 2 })
          : HttpResponse.json({ issues: [pageTwoIssue], nextPage: null });
      }),
    );

    const { result } = renderHookWithProviders(() => useProjectIssuesQuery(PROJECT_ID));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data).toEqual([...issues, pageTwoIssue]);
    expect(result.current.hasNextPage).toBe(false);
    expect(requestedPages).toEqual(['1', '2']);
  });

  it('given no github project id, when the hook mounts, then no request is made', async () => {
    const hit = vi.fn();
    server.use(
      http.get(ISSUES_URL, () => {
        hit();
        return HttpResponse.json({ issues, nextPage: null });
      }),
    );

    const { result, client } = renderHookWithProviders(() => useProjectIssuesQuery(undefined));

    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(result.current.fetchStatus).toBe('idle');
    expect(hit).not.toHaveBeenCalled();
  });

  it('given the server fails, when the hook resolves, then it surfaces the server message', async () => {
    server.use(
      http.get(ISSUES_URL, () => HttpResponse.json({ error: 'github_error', message: 'boom' }, { status: 502 })),
    );

    const { result } = renderHookWithProviders(() => useProjectIssuesQuery(PROJECT_ID));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('boom');
  });
});

describe('useProjectPullRequestsQuery', () => {
  it('given the server returns pull requests, when the hook resolves, then it exposes them', async () => {
    server.use(http.get(PRS_URL, () => HttpResponse.json({ pullRequests, nextPage: null })));

    const { result } = renderHookWithProviders(() => useProjectPullRequestsQuery(PROJECT_ID));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(pullRequests);
  });

  it('given no github project id, when the hook mounts, then no request is made', async () => {
    const hit = vi.fn();
    server.use(
      http.get(PRS_URL, () => {
        hit();
        return HttpResponse.json({ pullRequests, nextPage: null });
      }),
    );

    const { result, client } = renderHookWithProviders(() => useProjectPullRequestsQuery(undefined));

    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(result.current.fetchStatus).toBe('idle');
    expect(hit).not.toHaveBeenCalled();
  });
});

const THREAD_ID = 'factory-thread-1';
const RESOURCE_ID = 'resource-1';
const PROJECT_PATH = '/home/user/project';
const THREAD_CONTEXT_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/threads/${THREAD_ID}/context`;

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>(next => {
    resolve = next;
  });
  return { promise, resolve };
}

function taskContext(title: string): FactoryThreadTaskContext {
  return {
    task: {
      source: 'github-issue',
      identifier: '42',
      title,
      description: 'Task description',
      state: 'open',
      labels: ['bug'],
      assignees: ['ada'],
      url: 'https://github.com/mastra-ai/mastra/issues/42',
    },
    resolution: { mode: 'live' },
  };
}

function StrictModeTaskContextProbe() {
  useFactoryThreadTaskContextQuery(PROJECT_ID, THREAD_ID, RESOURCE_ID, PROJECT_PATH, true);
  return null;
}

describe('useFactoryThreadTaskContextQuery', () => {
  it('given the Task observer is disabled, when the hook mounts, then it makes zero requests', async () => {
    const hit = vi.fn();
    server.use(
      http.get(THREAD_CONTEXT_URL, () => {
        hit();
        return HttpResponse.json({ context: taskContext('Disabled') });
      }),
    );

    const { result, client } = renderHookWithProviders(() =>
      useFactoryThreadTaskContextQuery(PROJECT_ID, THREAD_ID, RESOURCE_ID, PROJECT_PATH, false),
    );

    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(result.current.fetchStatus).toBe('idle');
    expect(hit).not.toHaveBeenCalled();
  });

  it('given Task is enabled, when it loads, then the credentialed request carries the exact session address', async () => {
    const credentials: RequestCredentials[] = [];
    const requests: URL[] = [];
    server.use(
      http.get(THREAD_CONTEXT_URL, ({ request }) => {
        credentials.push(request.credentials);
        requests.push(new URL(request.url));
        return HttpResponse.json({ context: taskContext('Live task') });
      }),
    );

    const { result } = renderHookWithProviders(() =>
      useFactoryThreadTaskContextQuery(PROJECT_ID, THREAD_ID, RESOURCE_ID, PROJECT_PATH, true),
    );

    await waitFor(() => expect(result.current.data?.task.title).toBe('Live task'));
    expect(credentials).toEqual(['include']);
    expect(requests[0]?.searchParams.get('resourceId')).toBe(RESOURCE_ID);
    expect(requests[0]?.searchParams.get('projectPath')).toBe(PROJECT_PATH);
  });

  it('given the app mounts in StrictMode, when Task loads, then the discarded mount makes no network request', async () => {
    const hit = vi.fn();
    server.use(
      http.get(THREAD_CONTEXT_URL, () => {
        hit();
        return HttpResponse.json({ context: taskContext('Strict task') });
      }),
    );

    renderWithProviders(
      <StrictMode>
        <StrictModeTaskContextProbe />
      </StrictMode>,
    );

    await waitFor(() => expect(hit).toHaveBeenCalledTimes(1));
  });

  it('given an enabled request is in flight, when its observer unmounts, then the fetch signal aborts', async () => {
    const started = deferred();
    const aborted = deferred();
    server.use(
      http.get(THREAD_CONTEXT_URL, async ({ request }) => {
        request.signal.addEventListener('abort', () => aborted.resolve(), { once: true });
        started.resolve();
        await aborted.promise;
        return HttpResponse.json({ context: taskContext('Cancelled') });
      }),
    );

    const { unmount } = renderHookWithProviders(() =>
      useFactoryThreadTaskContextQuery(PROJECT_ID, THREAD_ID, RESOURCE_ID, PROJECT_PATH, true),
    );
    await started.promise;

    unmount();

    await expect(aborted.promise).resolves.toBeUndefined();
  });

  it('given fresh provider data, when Refresh is requested, then it replaces the cached context', async () => {
    let requestCount = 0;
    server.use(
      http.get(THREAD_CONTEXT_URL, () => {
        requestCount += 1;
        return HttpResponse.json({ context: taskContext(`Task version ${requestCount}`) });
      }),
    );
    const { result } = renderHookWithProviders(() =>
      useFactoryThreadTaskContextQuery(PROJECT_ID, THREAD_ID, RESOURCE_ID, PROJECT_PATH, true),
    );
    await waitFor(() => expect(result.current.data?.task.title).toBe('Task version 1'));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.data?.task.title).toBe('Task version 2'));
    expect(requestCount).toBe(2);
  });

  it('given Task has loaded, when time, focus, and connectivity change, then it does not refresh automatically', async () => {
    const hit = vi.fn();
    server.use(
      http.get(THREAD_CONTEXT_URL, () => {
        hit();
        return HttpResponse.json({ context: taskContext('Stable task') });
      }),
    );
    const { result } = renderHookWithProviders(() =>
      useFactoryThreadTaskContextQuery(PROJECT_ID, THREAD_ID, RESOURCE_ID, PROJECT_PATH, true),
    );
    await waitFor(() => expect(result.current.data?.task.title).toBe('Stable task'));
    expect(hit).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(120_000);
    vi.useRealTimers();

    expect(hit).toHaveBeenCalledTimes(1);
  });
});
