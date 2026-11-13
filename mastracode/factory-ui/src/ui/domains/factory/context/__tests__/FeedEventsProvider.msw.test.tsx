// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pushableFeedStream } from '../../../../../../e2e/ui/feed-stream';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { useSidebarWorkItemsQuery } from '../../../../../hooks/useWorkItems';
import { HIDDEN_STREAM_GRACE_MS } from '../../../../lib/hooks/useDocumentVisible';
import { FeedEventsProvider } from '../FeedEventsProvider';

const PROJECT_ID = 'project-1';
const BOARD_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`;
const FEED_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/feed-events`;
/** The provider's retry delay, plus room for the request to land. */
const PAST_ONE_RETRY_MS = 5_000;

function inner({ children }: { children: React.ReactNode }) {
  return <FeedEventsProvider factoryProjectId={PROJECT_ID}>{children}</FeedEventsProvider>;
}

function watch() {
  return useSidebarWorkItemsQuery(PROJECT_ID);
}

function countCardReads(count: () => void) {
  return http.get(BOARD_URL, () => {
    count();
    return HttpResponse.json({ workItems: [], runningSessionIds: [], parkedSessionIds: [] });
  });
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => setVisibility('visible'));

describe('FeedEventsProvider', () => {
  it('reconnects after a drop and catches up on what the closed stream never announced', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    let cardReads = 0;
    server.use(
      stream.handler,
      countCardReads(() => (cardReads += 1)),
    );

    const rendered = renderHookWithProviders(watch, { inner });
    await waitFor(() => expect(stream.open).toBe(true));
    await waitFor(() => expect(rendered.result.current.isSuccess).toBe(true));
    await waitForMutationsIdle(rendered.client);
    const before = cardReads;

    stream.close();
    await waitFor(() => expect(stream.opens).toBe(2), { timeout: PAST_ONE_RETRY_MS });
    // Nothing on the wire said what changed while the stream was down.
    await waitFor(() => expect(cardReads).toBeGreaterThan(before), { timeout: PAST_ONE_RETRY_MS });
  });

  it('keeps the stream through a quick tab switch', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(
      stream.handler,
      countCardReads(() => {}),
    );

    const rendered = renderHookWithProviders(watch, { inner });
    await waitFor(() => expect(stream.open).toBe(true));
    await waitForMutationsIdle(rendered.client);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      act(() => setVisibility('hidden'));
      act(() => vi.advanceTimersByTime(HIDDEN_STREAM_GRACE_MS - 1_000));
      act(() => setVisibility('visible'));
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(stream.open).toBe(true);
      expect(stream.opens).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('releases the stream when the tab is left hidden and catches up when it comes back', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    let cardReads = 0;
    server.use(
      stream.handler,
      countCardReads(() => (cardReads += 1)),
    );

    const rendered = renderHookWithProviders(watch, { inner });
    await waitFor(() => expect(stream.open).toBe(true));
    await waitFor(() => expect(rendered.result.current.isSuccess).toBe(true));
    await waitForMutationsIdle(rendered.client);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      act(() => setVisibility('hidden'));
      act(() => vi.advanceTimersByTime(HIDDEN_STREAM_GRACE_MS));
      await act(() => vi.advanceTimersByTimeAsync(5_000));
      const before = cardReads;
      // Released, not retried: a hidden tab opens nothing until it is looked at again.
      expect(stream.opens).toBe(1);

      act(() => setVisibility('visible'));
      await waitFor(() => expect(stream.opens).toBe(2));
      // A tab left hidden holds no stream, so nothing announced what landed meanwhile.
      await act(() => vi.advanceTimersByTimeAsync(1_000));
      await waitFor(() => expect(cardReads).toBeGreaterThan(before));
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
      countCardReads(() => {}),
    );

    renderHookWithProviders(watch, { inner });
    await waitFor(() => expect(opens).toBe(1));

    // A refused stream never heals by retrying; the fallback poll carries on.
    await new Promise(resolve => setTimeout(resolve, PAST_ONE_RETRY_MS));
    expect(opens).toBe(1);
  });
});
