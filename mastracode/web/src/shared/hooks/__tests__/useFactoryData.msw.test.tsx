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

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import type { GithubIssue, GithubPullRequest } from '../../../web/ui/domains/factory/services/factory';
import { useProjectIssuesQuery, useProjectPullRequestsQuery } from '../useFactoryData';

const PROJECT_ID = 'github-project-1';
const ISSUES_URL = `${TEST_BASE_URL}/web/github/repositories/${PROJECT_ID}/issues`;
const PRS_URL = `${TEST_BASE_URL}/web/github/repositories/${PROJECT_ID}/prs`;

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
