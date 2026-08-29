// @vitest-environment jsdom
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { pushableFeedStream } from '../../../../../../e2e/ui/feed-stream';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { useFactoryAttentionHistory } from '../../../../../hooks/useFactoryAttention';
import { useWorkItemComments } from '../../../../../hooks/useWorkItemComments';
import { FeedEventsProvider, useFeedEventsConnected } from '../FeedEventsProvider';

const PROJECT_ID = 'project-1';
const OTHER_PROJECT_ID = 'project-2';
const ITEM_ID = 'item-1';
const COMMENTS_URL = `${TEST_BASE_URL}/web/factory/work-items/${ITEM_ID}/comments`;
/** The provider's retry delay, plus room for the request to land. */
const PAST_ONE_RETRY_MS = 5_000;

function inner({ children }: { children: React.ReactNode }) {
  return <FeedEventsProvider factoryProjectId={PROJECT_ID}>{children}</FeedEventsProvider>;
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => setVisibility('visible'));

describe('FeedEventsProvider', () => {
  it('refetches the named work item feed when a frame arrives', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    let commentRequests = 0;
    server.use(
      stream.handler,
      http.get(COMMENTS_URL, () => {
        commentRequests += 1;
        return HttpResponse.json({ comments: [] });
      }),
    );

    const { result } = renderHookWithProviders(() => useWorkItemComments({ workItemId: ITEM_ID }), { inner });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(commentRequests).toBe(1);

    stream.push(ITEM_ID);
    await waitFor(() => expect(commentRequests).toBe(2));
  });

  it('refetches attention when a frame arrives', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    let attentionRequests = 0;
    server.use(
      stream.handler,
      http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/attention`, () => {
        attentionRequests += 1;
        return HttpResponse.json({
          items: [],
          openCount: 0,
          approvalCount: 0,
          badgeCount: 0,
          unreadCount: 0,
          activityUnreadCount: 0,
          hasMore: false,
        });
      }),
    );

    const { result } = renderHookWithProviders(() => useFactoryAttentionHistory(PROJECT_ID, 'open', ''), { inner });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(attentionRequests).toBe(1);

    stream.push(ITEM_ID);
    await waitFor(() => expect(attentionRequests).toBe(2));
  });

  it('leaves another work item alone', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    let commentRequests = 0;
    server.use(
      stream.handler,
      http.get(COMMENTS_URL, () => {
        commentRequests += 1;
        return HttpResponse.json({ comments: [] });
      }),
    );

    const { result } = renderHookWithProviders(() => useWorkItemComments({ workItemId: ITEM_ID }), { inner });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    stream.push('some-other-item');
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(commentRequests).toBe(1);

    // The named item still refetches: the stream was live all along.
    stream.push(ITEM_ID);
    await waitFor(() => expect(commentRequests).toBe(2));
  });

  it('reports connected while the stream is open and disconnected once it ends', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);

    const { result } = renderHookWithProviders(() => useFeedEventsConnected(), { inner });
    await waitFor(() => expect(result.current).toBe(true));

    stream.close();
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('reconnects after a drop and catches up on what the closed stream never announced', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    let commentRequests = 0;
    server.use(
      stream.handler,
      http.get(COMMENTS_URL, () => {
        commentRequests += 1;
        return HttpResponse.json({ comments: [] });
      }),
    );

    const { result } = renderHookWithProviders(
      () => ({ connected: useFeedEventsConnected(), comments: useWorkItemComments({ workItemId: ITEM_ID }) }),
      { inner },
    );
    await waitFor(() => expect(result.current.connected).toBe(true));
    await waitFor(() => expect(commentRequests).toBe(1));

    stream.close();
    await waitFor(() => expect(result.current.connected).toBe(false));

    await waitFor(() => expect(stream.opens).toBe(2), { timeout: PAST_ONE_RETRY_MS });
    await waitFor(() => expect(result.current.connected).toBe(true));
    // Nothing on the wire said what changed while the stream was down.
    await waitFor(() => expect(commentRequests).toBeGreaterThan(1));
  });

  it('catches up on comments written while the tab was hidden', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    let commentRequests = 0;
    server.use(
      stream.handler,
      http.get(COMMENTS_URL, () => {
        commentRequests += 1;
        return HttpResponse.json({ comments: [] });
      }),
    );

    const { result } = renderHookWithProviders(
      () => ({ connected: useFeedEventsConnected(), comments: useWorkItemComments({ workItemId: ITEM_ID }) }),
      { inner },
    );
    await waitFor(() => expect(result.current.connected).toBe(true));
    await waitFor(() => expect(commentRequests).toBe(1));

    setVisibility('hidden');
    await waitFor(() => expect(result.current.connected).toBe(false));

    setVisibility('visible');
    await waitFor(() => expect(result.current.connected).toBe(true));
    // A hidden tab holds no stream, so nothing announced what landed meanwhile.
    await waitFor(() => expect(commentRequests).toBe(2));
  });

  it('closes the gap when a project the tab left comes back', async () => {
    const streamA = pushableFeedStream(PROJECT_ID);
    const streamB = pushableFeedStream(OTHER_PROJECT_ID);
    let commentRequests = 0;
    server.use(
      streamA.handler,
      streamB.handler,
      http.get(COMMENTS_URL, () => {
        commentRequests += 1;
        return HttpResponse.json({ comments: [] });
      }),
    );

    function Probe() {
      useWorkItemComments({ workItemId: ITEM_ID });
      return null;
    }
    const watching = (projectId: string) => (
      <FeedEventsProvider factoryProjectId={projectId}>
        <Probe />
      </FeedEventsProvider>
    );

    const { rerender } = renderWithProviders(watching(PROJECT_ID));
    await waitFor(() => expect(streamA.opens).toBe(1));
    await waitFor(() => expect(commentRequests).toBe(1));

    rerender(watching(OTHER_PROJECT_ID));
    await waitFor(() => expect(streamB.opens).toBe(1));
    await waitFor(() => expect(commentRequests).toBe(2));

    // Nothing watched this project while the tab was on the other one.
    rerender(watching(PROJECT_ID));
    await waitFor(() => expect(streamA.opens).toBe(2));
    await waitFor(() => expect(commentRequests).toBe(3));
  });
});
