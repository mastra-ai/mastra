import { useQuery } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pushableFeedStream } from '../../../e2e/ui/feed-stream';
import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { FeedEventsProvider } from '../../ui/domains/factory/context/FeedEventsProvider';
import { pullRequestSubscriptionsQuery } from '../../ui/domains/factory/services/githubSubscriptions';
import type { SessionPullRequestTarget } from '../useSessionPullRequestSubscriptions';
import { useSessionPullRequestSubscriptions } from '../useSessionPullRequestSubscriptions';

const PROJECT_ID = 'project-1';
const WITHIN_A_SECOND_MS = 900;
const PAST_ONE_REFRESH_GAP_MS = 6_000;
const SEVERAL_OLD_POLLS_MS = 20_000;

const target: SessionPullRequestTarget = { sessionId: 'session-1', threadId: 'thread-1', provider: 'github' };

const openSubscription = {
  id: 'subscription-42',
  repoFullName: 'acme/app',
  pullRequestNumber: 42,
  status: 'open',
  url: 'https://github.com/acme/app/pull/42',
  updatedAt: '2026-07-22T00:00:00.000Z',
};

function inner({ children }: { children: ReactNode }) {
  return <FeedEventsProvider factoryProjectId={PROJECT_ID}>{children}</FeedEventsProvider>;
}

function countSubscriptionReads(subscriptions = [openSubscription]) {
  const stream = pushableFeedStream(PROJECT_ID);
  const reads = { count: 0 };
  server.use(
    stream.handler,
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => {
      reads.count += 1;
      return HttpResponse.json({ subscriptions });
    }),
  );
  return { stream, reads };
}

async function renderQuietSidebarSession(subscriptions = [openSubscription]) {
  const { stream, reads } = countSubscriptionReads(subscriptions);
  const { result } = renderHookWithProviders(
    () => useSessionPullRequestSubscriptions({ baseUrl: TEST_BASE_URL, targets: [target], enabled: true }),
    { inner },
  );
  await waitFor(() => expect(stream.open).toBe(true));
  await waitFor(() => expect(result.current[target.sessionId]).toHaveLength(subscriptions.length));
  await act(() => vi.advanceTimersByTimeAsync(PAST_ONE_REFRESH_GAP_MS));
  return { stream, reads };
}

describe('useSessionPullRequestSubscriptions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads an open pull request again within a second of the feed announcing a change', async () => {
    const { stream, reads } = await renderQuietSidebarSession();
    const before = reads.count;

    stream.push();
    await act(() => vi.advanceTimersByTimeAsync(WITHIN_A_SECOND_MS));

    await waitFor(() => expect(reads.count).toBe(before + 1));
  });

  it.each([
    { situation: 'no subscription follows', subscriptions: [] },
    { situation: 'is already merged', subscriptions: [{ ...openSubscription, status: 'merged' }] },
  ])('reads a pull request that $situation once, whatever the feed announces', async ({ subscriptions }) => {
    const { stream, reads } = await renderQuietSidebarSession(subscriptions);
    const before = reads.count;

    stream.push();
    await act(() => vi.advanceTimersByTimeAsync(PAST_ONE_REFRESH_GAP_MS));

    expect(reads.count).toBe(before);
  });

  it('asks nothing while the feed is connected and silent, even with a pull request open', async () => {
    const { reads } = await renderQuietSidebarSession();
    const before = reads.count;

    await act(() => vi.advanceTimersByTimeAsync(SEVERAL_OLD_POLLS_MS));

    expect(reads.count).toBe(before);
  });

  it("leaves a session page's own read of its subscriptions alone when the feed announces a change", async () => {
    const { stream, reads } = countSubscriptionReads();
    const { result } = renderHookWithProviders(
      () => useQuery(pullRequestSubscriptionsQuery(TEST_BASE_URL, target.sessionId, target.threadId, 'github', true)),
      { inner },
    );
    await waitFor(() => expect(stream.open).toBe(true));
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    await act(() => vi.advanceTimersByTimeAsync(PAST_ONE_REFRESH_GAP_MS));
    const before = reads.count;

    stream.push();
    await act(() => vi.advanceTimersByTimeAsync(PAST_ONE_REFRESH_GAP_MS));

    expect(reads.count).toBe(before);
  });
});
