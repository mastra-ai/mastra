/**
 * BDD coverage for the Factory data hooks.
 *
 * Drives the real factory services + React Query cache; only the network is
 * mocked (MSW). Handlers register on the ApiConfig base URL the test providers
 * inject (`TEST_BASE_URL`), matching how the app wires it.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { GithubIssue, GithubPullRequest } from '../../ui/domains/factory/services/factory';
import {
  INTAKE_ERROR_POLL_MS,
  INTAKE_POLL_MS,
  useProjectIssuesQuery,
  useProjectPullRequestsQuery,
} from '../useFactoryData';

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

    const { result } = renderHookWithProviders(() => useProjectIssuesQuery([PROJECT_ID]));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual(issues);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('given more pages, when fetchNextPage is called, then pages accumulate in order', async () => {
    const pageTwoIssue: GithubIssue = { ...issues[0], number: 13, title: 'Page two issue' };
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

    const { result } = renderHookWithProviders(() => useProjectIssuesQuery([PROJECT_ID]));

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

    const { result, client } = renderHookWithProviders(() => useProjectIssuesQuery([]));

    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(result.current.fetchStatus).toBe('idle');
    expect(hit).not.toHaveBeenCalled();
  });

  it('given new intake arrives after mount, when the poll interval elapses, then the feed refreshes without a reload', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let hits = 0;
      const freshIssue: GithubIssue = { ...issues[0], number: 99, title: 'Fresh intake' };
      server.use(
        http.get(ISSUES_URL, () => {
          hits += 1;
          return hits === 1
            ? HttpResponse.json({ issues, nextPage: null })
            : HttpResponse.json({ issues: [...issues, freshIssue], nextPage: null });
        }),
      );

      const { result } = renderHookWithProviders(() => useProjectIssuesQuery([PROJECT_ID]));
      await waitFor(() => expect(result.current.data).toBeDefined());
      expect(result.current.data).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(INTAKE_POLL_MS + 1_000);

      await waitFor(() => expect(result.current.data).toHaveLength(2));
      expect(result.current.data?.map(issue => issue.number)).toEqual([12, 99]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('given the server fails, when the hook resolves, then it surfaces the server message', async () => {
    server.use(
      http.get(ISSUES_URL, () => HttpResponse.json({ error: 'github_error', message: 'boom' }, { status: 502 })),
    );

    const { result } = renderHookWithProviders(() => useProjectIssuesQuery([PROJECT_ID]));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('boom');
  });

  it('given the feed keeps failing, when the normal poll interval elapses, then it backs off instead of hammering', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let hits = 0;
      server.use(
        http.get(ISSUES_URL, () => {
          hits += 1;
          return HttpResponse.json({ error: 'github_error', message: 'installation unavailable' }, { status: 502 });
        }),
      );

      const { result } = renderHookWithProviders(() => useProjectIssuesQuery([PROJECT_ID]));
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(hits).toBe(1);

      await vi.advanceTimersByTimeAsync(INTAKE_POLL_MS + 1_000);
      expect(hits).toBe(1);

      await vi.advanceTimersByTimeAsync(INTAKE_ERROR_POLL_MS);
      await waitFor(() => expect(hits).toBe(2));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useProjectPullRequestsQuery', () => {
  it('given the server returns pull requests, when the hook resolves, then it exposes them', async () => {
    server.use(http.get(PRS_URL, () => HttpResponse.json({ pullRequests, nextPage: null })));

    const { result } = renderHookWithProviders(() => useProjectPullRequestsQuery([PROJECT_ID]));

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

    const { result, client } = renderHookWithProviders(() => useProjectPullRequestsQuery([]));

    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(result.current.fetchStatus).toBe('idle');
    expect(hit).not.toHaveBeenCalled();
  });
});

describe('intake feeds across linked repositories', () => {
  const SECOND_ID = 'github-project-2';
  const SECOND_ISSUES_URL = `${TEST_BASE_URL}/web/github/projects/${SECOND_ID}/issues`;
  const secondIssue: GithubIssue = { ...issues[0], number: 7, title: 'Second repository issue', repositoryId: 2 };

  it('given two linked repositories, when the feed resolves, then it carries issues from both', async () => {
    server.use(
      http.get(ISSUES_URL, () => HttpResponse.json({ issues, nextPage: null })),
      http.get(SECOND_ISSUES_URL, () => HttpResponse.json({ issues: [secondIssue], nextPage: null })),
    );

    const { result } = renderHookWithProviders(() => useProjectIssuesQuery([PROJECT_ID, SECOND_ID]));

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data?.map(issue => issue.number)).toEqual([12, 7]);
  });

  it('given repositories with different page counts, when more pages load, then only repositories with more pages are requested', async () => {
    const requests: string[] = [];
    server.use(
      http.get(ISSUES_URL, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        requests.push(`first:${page}`);
        return page === '1'
          ? HttpResponse.json({ issues, nextPage: 2 })
          : HttpResponse.json({ issues: [{ ...issues[0], number: 13 }], nextPage: null });
      }),
      http.get(SECOND_ISSUES_URL, ({ request }) => {
        requests.push(`second:${new URL(request.url).searchParams.get('page')}`);
        return HttpResponse.json({ issues: [secondIssue], nextPage: null });
      }),
    );

    const { result } = renderHookWithProviders(() => useProjectIssuesQuery([PROJECT_ID, SECOND_ID]));
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.map(issue => issue.number)).toEqual([12, 7, 13]));
    expect(result.current.hasNextPage).toBe(false);
    expect(requests.sort()).toEqual(['first:1', 'first:2', 'second:1']);
  });

  it('given one repository fails, when the feed resolves, then the other repository still feeds intake', async () => {
    server.use(
      http.get(ISSUES_URL, () => HttpResponse.json({ error: 'github_error', message: 'boom' }, { status: 502 })),
      http.get(SECOND_ISSUES_URL, () => HttpResponse.json({ issues: [secondIssue], nextPage: null })),
    );

    const { result } = renderHookWithProviders(() => useProjectIssuesQuery([PROJECT_ID, SECOND_ID]));

    await waitFor(() => expect(result.current.data).toEqual([secondIssue]));
    expect(result.current.isError).toBe(false);
  });

  it('given every repository fails, when the feed resolves, then it surfaces the error', async () => {
    server.use(
      http.get(PRS_URL, () => HttpResponse.json({ error: 'github_error', message: 'boom' }, { status: 502 })),
      http.get(`${TEST_BASE_URL}/web/github/projects/${SECOND_ID}/prs`, () =>
        HttpResponse.json({ error: 'github_error', message: 'boom' }, { status: 502 }),
      ),
    );

    const { result } = renderHookWithProviders(() => useProjectPullRequestsQuery([PROJECT_ID, SECOND_ID]));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
