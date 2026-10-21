import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../e2e/ui/render';
import type { RepositoryCommit, RepositoryCommitsPage } from '../ui/domains/factory/services/commits';
import { useRepositoryCommits } from './useRepositoryCommits';

const MINUTE_MS = 60_000;
const NOW_MS = Date.UTC(2026, 9, 21, 12);
const endpoint = `${TEST_BASE_URL}/web/github/projects/:id/commits`;

function commitsAgo(firstMinute: number, count: number): RepositoryCommit[] {
  return Array.from({ length: count }, (_, index) => {
    const minute = firstMinute + index;
    return {
      sha: `sha-${minute}`,
      message: `Commit ${minute} minutes ago`,
      author: 'ada',
      avatarUrl: null,
      committedAt: new Date(NOW_MS - minute * MINUTE_MS).toISOString(),
      url: `https://github.com/acme/app/commit/sha-${minute}`,
    };
  });
}

const PAGES: Record<string, RepositoryCommit[]> = {
  'branch:1': commitsAgo(0, 100),
  'sha-0:2': commitsAgo(100, 100),
  'sha-0:3': commitsAgo(200, 100),
  'sha-0:4': commitsAgo(300, 30),
};

function serveHistory(failing: ReadonlySet<string> = new Set()) {
  const requested: string[] = [];
  server.use(
    http.get(endpoint, ({ request }) => {
      const query = new URL(request.url).searchParams;
      const page = `${query.get('from') ?? 'branch'}:${query.get('page') ?? 1}`;
      requested.push(page);
      if (failing.has(page)) return HttpResponse.json({ error: 'rate limited' }, { status: 403 });
      return HttpResponse.json({ commits: PAGES[page] ?? [], branch: 'main' } satisfies RepositoryCommitsPage);
    }),
  );
  return requested;
}

function minutesAgo(minutes: number): number {
  return NOW_MS - minutes * MINUTE_MS;
}

describe('repository commits for a time window', () => {
  it('loads an older page only when the view reaches past the oldest loaded commit', async () => {
    const requested = serveHistory();
    const { result, rerender, client } = renderHookWithProviders(
      ({ viewStartMs }) => useRepositoryCommits('repo-1', viewStartMs),
      { initialProps: { viewStartMs: minutesAgo(60) } },
    );

    await waitFor(() => expect(result.current.commits).toHaveLength(100));
    await waitForMutationsIdle(client);
    expect(requested).toEqual(['branch:1']);

    rerender({ viewStartMs: minutesAgo(150) });
    await waitFor(() => expect(result.current.commits).toHaveLength(200));
    rerender({ viewStartMs: minutesAgo(160) });
    await waitForMutationsIdle(client);
    expect(requested).toEqual(['branch:1', 'sha-0:2']);

    rerender({ viewStartMs: minutesAgo(10_000) });
    await waitFor(() => expect(result.current.commits).toHaveLength(330));
    await waitForMutationsIdle(client);
    expect(requested).toEqual(['branch:1', 'sha-0:2', 'sha-0:3', 'sha-0:4']);
  });

  it('keeps the loaded commits when an older page fails, and retries only that page', async () => {
    const failing = new Set(['sha-0:3']);
    const requested = serveHistory(failing);
    const { result, client } = renderHookWithProviders(() => useRepositoryCommits('repo-1', minutesAgo(10_000)));

    await waitFor(() => expect(result.current.olderFailed).toBe(true));
    expect(result.current.commits).toHaveLength(200);

    failing.clear();
    act(() => result.current.retryOlder());
    await waitFor(() => expect(result.current.commits).toHaveLength(330));
    await waitForMutationsIdle(client);
    expect(requested).toEqual(['branch:1', 'sha-0:2', 'sha-0:3', 'sha-0:3', 'sha-0:4']);
    expect(result.current.olderFailed).toBe(false);
  });

  it('stops paging when the server answers an older page with commits it already sent', async () => {
    const requested: string[] = [];
    server.use(
      http.get(endpoint, ({ request }) => {
        requested.push(new URL(request.url).searchParams.get('page') ?? '1');
        return HttpResponse.json({ commits: commitsAgo(0, 100), branch: 'main' } satisfies RepositoryCommitsPage);
      }),
    );
    const { result, client } = renderHookWithProviders(() => useRepositoryCommits('repo-1', minutesAgo(10_000)));

    await waitFor(() => expect(result.current.commits).toHaveLength(300));
    await act(async () => {});
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(requested).toEqual(['1', '2', '3']);
  });
});
