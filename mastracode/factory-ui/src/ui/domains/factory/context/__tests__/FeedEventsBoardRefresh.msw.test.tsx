// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { pushableFeedStream } from '../../../../../../e2e/ui/feed-stream';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { useActiveRunResourceIds } from '../../../../../hooks/useActiveRunResources';
import { useFactoryDecisionStatus } from '../../../../../hooks/useFactoryDecisions';
import { useWorkItemsQuery } from '../../../../../hooks/useWorkItems';
import { AGENT_CONTROLLER_ID } from '../../../chat/services/constants';
import { FeedEventsProvider, useFeedEventsConnected } from '../FeedEventsProvider';

const PROJECT_ID = 'project-1';
const BOARD_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`;
const DECISIONS_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/decisions`;
const RUNS_URL = '*/api/agent-controller/:controllerId/active-runs';
const FEED_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/feed-events`;
/** The slowest board poll without a stream (cards and runs, 5 s), plus room for the request to land. */
const PAST_ONE_FALLBACK_POLL_MS = 7_000;
/** The provider's retry delay, plus room for the request to land. */
const PAST_ONE_RETRY_MS = 5_000;

function card(title: string) {
  return {
    id: 'item-1',
    orgId: 'org-1',
    factoryProjectId: PROJECT_ID,
    title,
    stages: ['intake'],
    sessions: {},
    metadata: {},
    revision: 1,
    createdAt: '2030-01-01T00:00:00.000Z',
    updatedAt: '2030-01-01T00:00:00.000Z',
  };
}

function inner({ children }: { children: React.ReactNode }) {
  return <FeedEventsProvider factoryProjectId={PROJECT_ID}>{children}</FeedEventsProvider>;
}

function watchBoard() {
  return {
    connected: useFeedEventsConnected(),
    cards: useWorkItemsQuery(PROJECT_ID),
    decisions: useFactoryDecisionStatus(PROJECT_ID, ['pending', 'leased']),
    running: useActiveRunResourceIds(AGENT_CONTROLLER_ID),
  };
}

interface BoardRequests {
  cards: number;
  decisions: number;
  runs: number;
}

/** Requests per board endpoint; `title` is what the next card read answers. */
function boardEndpoints(options: { boardReadMs?: number } = {}) {
  const requests: BoardRequests = { cards: 0, decisions: 0, runs: 0 };
  const board = { title: 'Fix login' };
  server.use(
    http.get(BOARD_URL, async () => {
      requests.cards += 1;
      const title = board.title;
      if (options.boardReadMs) await delay(options.boardReadMs);
      return HttpResponse.json({ workItems: [card(title)], runningSessionIds: [], parkedSessionIds: [] });
    }),
    http.get(DECISIONS_URL, () => {
      requests.decisions += 1;
      return HttpResponse.json({ decisions: [] });
    }),
    http.get(RUNS_URL, () => {
      requests.runs += 1;
      return HttpResponse.json({ runs: [] });
    }),
  );
  return { requests, board };
}

async function renderConnectedBoard() {
  const rendered = renderHookWithProviders(watchBoard, { inner });
  await waitFor(() => expect(rendered.result.current.connected).toBe(true));
  await waitFor(() => expect(rendered.result.current.cards.isSuccess).toBe(true));
  await waitForMutationsIdle(rendered.client);
  return rendered;
}

describe('FeedEventsProvider, on the board', () => {
  it('refreshes cards, decisions and runs when a frame arrives', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = boardEndpoints();
    const rendered = await renderConnectedBoard();
    const before = { ...requests };

    stream.push();

    await waitFor(() =>
      expect(requests).toEqual({ cards: before.cards + 1, decisions: before.decisions + 1, runs: before.runs + 1 }),
    );
    await waitForMutationsIdle(rendered.client);
  });

  it('folds a burst of frames into one refresh', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = boardEndpoints();
    const rendered = await renderConnectedBoard();
    const before = { ...requests };

    for (let frame = 0; frame < 5; frame += 1) stream.push();

    await waitFor(() => expect(requests.cards).toBe(before.cards + 1));
    await delay(1_000);
    expect(requests).toEqual({ cards: before.cards + 1, decisions: before.decisions + 1, runs: before.runs + 1 });
    await waitForMutationsIdle(rendered.client);
  });

  it('still lands a card change while frames keep arriving faster than the board reads', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { board } = boardEndpoints({ boardReadMs: 600 });
    const rendered = await renderConnectedBoard();
    board.title = 'Fix logout';

    const frames = setInterval(() => stream.push(), 200);
    try {
      await waitFor(() => expect(rendered.result.current.cards.data?.[0]?.title).toBe('Fix logout'), {
        timeout: 3_000,
      });
    } finally {
      clearInterval(frames);
    }
    await waitForMutationsIdle(rendered.client);
  });

  it('polls nothing while the stream is up, then polls again once it drops', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = boardEndpoints();
    // Before the mount, so the query intervals run on the fake clock.
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const rendered = await renderConnectedBoard();
      const connected = { ...requests };

      act(() => vi.advanceTimersByTime(PAST_ONE_FALLBACK_POLL_MS));
      await delay(50);
      expect(requests).toEqual(connected);

      server.use(http.get(FEED_URL, () => new HttpResponse(null, { status: 503 })));
      stream.close();
      await waitFor(() => expect(rendered.result.current.connected).toBe(false));
      const dropped = { ...requests };

      act(() => vi.advanceTimersByTime(PAST_ONE_FALLBACK_POLL_MS));
      await waitFor(() => {
        expect(requests.cards).toBeGreaterThan(dropped.cards);
        expect(requests.decisions).toBeGreaterThan(dropped.decisions);
        expect(requests.runs).toBeGreaterThan(dropped.runs);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('catches the board up when the stream comes back after a drop', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = boardEndpoints();
    const rendered = await renderConnectedBoard();

    stream.close();
    await waitFor(() => expect(rendered.result.current.connected).toBe(false));
    await waitFor(() => expect(stream.opens).toBe(2), { timeout: PAST_ONE_RETRY_MS });
    await waitFor(() => expect(rendered.result.current.connected).toBe(true));
    const reconnected = { ...requests };

    // Nothing on the wire said what changed while the stream was down.
    await waitFor(() =>
      expect(requests).toEqual({
        cards: reconnected.cards + 1,
        decisions: reconnected.decisions + 1,
        runs: reconnected.runs + 1,
      }),
    );
    await waitForMutationsIdle(rendered.client);
  });
});
