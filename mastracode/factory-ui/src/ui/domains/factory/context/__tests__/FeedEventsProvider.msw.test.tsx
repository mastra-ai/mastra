// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pushableFeedStream } from '../../../../../../e2e/ui/feed-stream';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { useWorkItemComments } from '../../../../../hooks/useWorkItemComments';
import { HIDDEN_STREAM_GRACE_MS } from '../../../../lib/hooks/useDocumentVisible';
import { FeedEventsProvider, useFeedEventsConnected } from '../FeedEventsProvider';

const PROJECT_ID = 'project-1';
const ITEM_ID = 'item-1';
const COMMENTS_URL = `${TEST_BASE_URL}/web/factory/work-items/${ITEM_ID}/comments`;
const FEED_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/feed-events`;
/** The provider's retry delay, plus room for the request to land. */
const PAST_ONE_RETRY_MS = 5_000;

function inner({ children }: { children: React.ReactNode }) {
  return <FeedEventsProvider factoryProjectId={PROJECT_ID}>{children}</FeedEventsProvider>;
}

function watch() {
  return {
    connected: useFeedEventsConnected(),
    comments: useWorkItemComments({ workItemId: ITEM_ID }),
  };
}

/** Connected, plus the catch-up refetch every fresh stream fires. */
async function settle(rendered: { result: { current: { connected: boolean } }; client: QueryClient }): Promise<void> {
  await waitFor(() => expect(rendered.result.current.connected).toBe(true));
  await waitForMutationsIdle(rendered.client);
}

function countComments(count: () => void) {
  return http.get(COMMENTS_URL, () => {
    count();
    return HttpResponse.json({ comments: [] });
  });
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
      countComments(() => (commentRequests += 1)),
    );

    const rendered = renderHookWithProviders(watch, { inner });
    const { result } = rendered;
    await settle(rendered);
    const before = commentRequests;

    stream.push(ITEM_ID);
    await waitFor(() => expect(commentRequests).toBe(before + 1));
  });

  it('leaves another work item alone', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    let commentRequests = 0;
    server.use(
      stream.handler,
      countComments(() => (commentRequests += 1)),
    );

    const rendered = renderHookWithProviders(watch, { inner });
    const { result } = rendered;
    await settle(rendered);
    const before = commentRequests;

    stream.push('some-other-item');
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(commentRequests).toBe(before);

    // The named item still refetches: the stream was live all along.
    stream.push(ITEM_ID);
    await waitFor(() => expect(commentRequests).toBe(before + 1));
  });

  it('reconnects after a drop and catches up on what the closed stream never announced', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    let commentRequests = 0;
    server.use(
      stream.handler,
      countComments(() => (commentRequests += 1)),
    );

    const rendered = renderHookWithProviders(watch, { inner });
    const { result } = rendered;
    await settle(rendered);
    const before = commentRequests;

    stream.close();
    await waitFor(() => expect(result.current.connected).toBe(false));

    await waitFor(() => expect(stream.opens).toBe(2), { timeout: PAST_ONE_RETRY_MS });
    await waitFor(() => expect(result.current.connected).toBe(true));
    // Nothing on the wire said what changed while the stream was down.
    await waitFor(() => expect(commentRequests).toBe(before + 1));
  });

  it('keeps the stream through a quick tab switch', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    let commentRequests = 0;
    server.use(
      stream.handler,
      countComments(() => (commentRequests += 1)),
    );

    const rendered = renderHookWithProviders(watch, { inner });
    const { result } = rendered;
    await settle(rendered);
    const before = commentRequests;
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      act(() => setVisibility('hidden'));
      act(() => vi.advanceTimersByTime(HIDDEN_STREAM_GRACE_MS - 1_000));
      act(() => setVisibility('visible'));
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(result.current.connected).toBe(true);
      expect(commentRequests).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it('catches up on comments when the tab comes back after being left hidden', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    let commentRequests = 0;
    server.use(
      stream.handler,
      countComments(() => (commentRequests += 1)),
    );

    const rendered = renderHookWithProviders(watch, { inner });
    const { result } = rendered;
    await settle(rendered);
    const before = commentRequests;
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      act(() => setVisibility('hidden'));
      act(() => vi.advanceTimersByTime(HIDDEN_STREAM_GRACE_MS));
      await waitFor(() => expect(result.current.connected).toBe(false));

      act(() => setVisibility('visible'));
      await waitFor(() => expect(result.current.connected).toBe(true));
      // A tab left hidden holds no stream, so nothing announced what landed meanwhile.
      await waitFor(() => expect(commentRequests).toBe(before + 1));
      await waitForMutationsIdle(rendered.client);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops reconnecting once the stream is refused', async () => {
    let opens = 0;
    server.use(
      http.get(FEED_URL, () => {
        opens += 1;
        return new HttpResponse(null, { status: 401 });
      }),
    );

    const { result } = renderHookWithProviders(watch, { inner });
    await waitFor(() => expect(opens).toBe(1));

    // A refused stream never heals by retrying; the fallback poll carries on.
    await new Promise(resolve => setTimeout(resolve, PAST_ONE_RETRY_MS));
    expect(opens).toBe(1);
    expect(result.current.connected).toBe(false);
  });
});
