// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pushableFeedStream } from '../../../../../../e2e/ui/feed-stream';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { useSidebarWorkItemsQuery } from '../../../../../hooks/useWorkItems';
import { workItem } from '../../../../__tests__/workBoardStubs';
import { HIDDEN_STREAM_GRACE_MS } from '../../../../lib/hooks/useDocumentVisible';
import { FeedEventsProvider } from '../FeedEventsProvider';

const PROJECT_ID = 'project-1';
const BOARD_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`;
const FEED_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/feed-events`;
/** The provider's retry delay, plus room for the request to land. */
const PAST_ONE_RETRY_MS = 5_000;
const PAST_SAFETY_POLL_MS = 70_000;
const PAST_REREAD_SPACING_MS = 5_000;

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

  describe('a frame naming what changed', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const card = (id: string, title: string, sessionId?: string) => ({
      ...workItem(id, title, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', PROJECT_ID),
      sessions: sessionId
        ? { work: { sessionId, threadId: `thread-${sessionId}`, branch: `factory/${sessionId}` } }
        : {},
    });
    const list = (workItems: object[], runningSessionIds: string[] = []) =>
      HttpResponse.json({ workItems, runningSessionIds, parkedSessionIds: [] });

    async function holdingTwoCards(answer: (url: URL) => Response | undefined) {
      const stream = pushableFeedStream(PROJECT_ID);
      const reads: string[] = [];
      server.use(
        stream.handler,
        http.get(BOARD_URL, ({ request }) => {
          const url = new URL(request.url);
          reads.push(url.search);
          const narrowed = url.searchParams.has('workItemId') || url.searchParams.has('sessionId');
          return (
            (narrowed ? answer(url) : undefined) ??
            list([card('card-a', 'Card A', 'session-a'), card('card-b', 'Card B', 'session-b')])
          );
        }),
      );
      const rendered = renderHookWithProviders(watch, { inner });
      await waitFor(() => expect(stream.open).toBe(true));
      await waitFor(() => expect(reads).toHaveLength(2));
      const titles = () => rendered.result.current.data?.workItems.map(item => item.title);
      await waitFor(() => expect(titles()).toEqual(['Card A', 'Card B']));
      await waitForMutationsIdle(rendered.client);
      reads.length = 0;
      const push = async (frame: object) => {
        stream.push(frame);
        await act(() => vi.advanceTimersByTimeAsync(PAST_REREAD_SPACING_MS));
      };
      return { stream, push, reads, rendered, titles };
    }

    it('rereads only the named card and puts it in place of the one held', async () => {
      const { push, reads, titles } = await holdingTwoCards(() =>
        list([card('card-a', 'Card A renamed', 'session-a')]),
      );

      await push({ cards: ['card-a'] });

      await waitFor(() => expect(titles()).toEqual(['Card A renamed', 'Card B']));
      expect(reads).toEqual(['?workItemId=card-a&scope=sessions']);
    });

    it('drops a named card the session list no longer holds, and adds one it now holds', async () => {
      const { push, reads, titles } = await holdingTwoCards(() => list([card('card-c', 'Card C', 'session-c')]));

      await push({ cards: ['card-a', 'card-c'] });

      await waitFor(() => expect(titles()).toEqual(['Card B', 'Card C']));
      expect(reads).toEqual(['?workItemId=card-a&workItemId=card-c&scope=sessions']);
    });

    it('reads the cards of a session whose run changed, and shows whether it runs', async () => {
      const { push, reads, rendered } = await holdingTwoCards(() =>
        list([card('card-a', 'Card A', 'session-a')], ['session-a']),
      );

      await push({ cards: [], sessions: ['session-a'] });

      await waitFor(() => expect(rendered.result.current.data?.runningSessionIds).toEqual(['session-a']));
      expect(reads).toEqual(['?sessionId=session-a']);
    });

    it('rereads the whole list for a frame that cannot say which cards changed', async () => {
      const { push, reads } = await holdingTwoCards(() => undefined);

      await push({});

      await waitFor(() => expect(reads).toEqual(['?scope=sessions']));
    });

    it('rereads the whole list once when the narrowed read fails', async () => {
      const { push, reads } = await holdingTwoCards(() => new HttpResponse(null, { status: 500 }));

      await push({ cards: ['card-a'] });

      await waitFor(() => expect(reads).toEqual(['?workItemId=card-a&scope=sessions', '?scope=sessions']));
    });

    it('leaves the whole list alone on the safety poll while the stream holds', async () => {
      const { stream, reads } = await holdingTwoCards(() => undefined);

      for (let waited = 0; waited < PAST_SAFETY_POLL_MS; waited += 20_000) {
        stream.ping();
        await act(() => vi.advanceTimersByTimeAsync(20_000));
      }

      expect(stream.opens).toBe(1);
      expect(reads).toEqual([]);
    });
  });
});
