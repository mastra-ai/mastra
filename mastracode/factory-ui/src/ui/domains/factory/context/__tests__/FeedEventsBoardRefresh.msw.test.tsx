// @vitest-environment jsdom
import { useQuery } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pushableFeedStream } from '../../../../../../e2e/ui/feed-stream';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { queryKeys } from '../../../../../api/keys';
import { useActiveRunResourceIds } from '../../../../../hooks/useActiveRunResources';
import { useFactoryDecisionStatus } from '../../../../../hooks/useFactoryDecisions';
import {
  useSessionWorkItemsQuery,
  useTransitionWorkItemMutation,
  useWorkItemsQuery,
  workItemActivityQueryOptions,
  workItemStartersQueryOptions,
} from '../../../../../hooks/useWorkItems';
import { createQueryClient } from '../../../../../query-client';
import { AGENT_CONTROLLER_ID } from '../../../chat/services/constants';
import { FeedEventsProvider } from '../FeedEventsProvider';

const PROJECT_ID = 'project-1';
const BOARD_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`;
const DECISIONS_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/decisions`;
const RUNS_URL = '*/api/agent-controller/:controllerId/active-runs';
const FEED_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/feed-events`;
const WITHIN_A_SECOND_MS = 900;
const PAST_ONE_REFRESH_GAP_MS = 6_000;
const PAST_ONE_FALLBACK_POLL_MS = 7_000;
const PAST_ONE_STREAM_RETRY_MS = 3_100;
const BOARD_READ_SLOWER_THAN_THE_REFRESH_GAP_MS = 8_000;
const SERVER_PING_EVERY_MS = 25_000;
const FIVE_MINUTES_OF_SERVER_PINGS = 12;
const PAST_THE_SILENCE_A_LIVE_STREAM_ALLOWS_MS = 61_000;

function card(title: string, stage = 'intake') {
  return {
    id: 'item-1',
    orgId: 'org-1',
    factoryProjectId: PROJECT_ID,
    title,
    stages: [stage],
    stageHistory: [],
    sessions: {},
    metadata: {},
    revision: 1,
    createdAt: '2030-01-01T00:00:00.000Z',
    updatedAt: '2030-01-01T00:00:00.000Z',
  };
}

function boardSnapshot(title: string, stage?: string) {
  return { workItems: [card(title, stage)], runningSessionIds: [], parkedSessionIds: [] };
}

function inner({ children }: { children: React.ReactNode }) {
  return <FeedEventsProvider factoryProjectId={PROJECT_ID}>{children}</FeedEventsProvider>;
}

function watchBoard() {
  return {
    cards: useWorkItemsQuery(PROJECT_ID),
    decisions: useFactoryDecisionStatus(PROJECT_ID, ['pending', 'leased']),
    running: useActiveRunResourceIds(AGENT_CONTROLLER_ID),
    move: useTransitionWorkItemMutation(PROJECT_ID),
  };
}

interface BoardRequests {
  cards: number;
  decisions: number;
  runs: number;
}

function moreRefreshes(requests: BoardRequests, count: number) {
  return { cards: requests.cards + count, decisions: requests.decisions + count, runs: requests.runs + count };
}

function oneMoreRefresh(requests: BoardRequests) {
  return moreRefreshes(requests, 1);
}

/** A card move the server holds until the test settles it; the board only reads `review` once it has. */
function heldCardMove(board: { stage: string }) {
  let settle = () => {};
  const settled = new Promise<void>(resolve => {
    settle = resolve;
  });
  server.use(
    http.post(`${BOARD_URL}/item-1/transition`, async () => {
      await settled;
      board.stage = 'review';
      return HttpResponse.json({
        result: {
          status: 'accepted',
          transitionId: 'transition-1',
          itemId: 'item-1',
          revision: 2,
          stage: 'review',
          decisions: [],
        },
      });
    }),
  );
  return settle;
}

function boardEndpoints() {
  const requests: BoardRequests = { cards: 0, decisions: 0, runs: 0 };
  const board = { title: 'Fix login', stage: 'intake', readMs: 0 };
  server.use(
    http.get(BOARD_URL, async () => {
      requests.cards += 1;
      const snapshot = boardSnapshot(board.title, board.stage);
      if (board.readMs) await delay(board.readMs);
      return HttpResponse.json(snapshot);
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

async function advance(client: QueryClient, ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
  await waitFor(() => expect(client.isFetching()).toBe(0));
}

type FeedStream = ReturnType<typeof pushableFeedStream>;

async function renderConnectedBoard(stream: FeedStream, client?: QueryClient) {
  const rendered = renderHookWithProviders(watchBoard, { inner, client });
  await waitFor(() => expect(stream.open).toBe(true));
  await waitFor(() => expect(rendered.result.current.cards.isSuccess).toBe(true));
  return rendered;
}

async function renderQuietBoard(stream: FeedStream) {
  const rendered = await renderConnectedBoard(stream);
  await advance(rendered.client, PAST_ONE_REFRESH_GAP_MS);
  await waitForMutationsIdle(rendered.client);
  return rendered;
}

describe('FeedEventsProvider, on the board', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshes cards, decisions and runs within a second of a lone frame', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = boardEndpoints();
    const rendered = await renderQuietBoard(stream);
    const before = { ...requests };

    stream.push();
    await advance(rendered.client, WITHIN_A_SECOND_MS);

    await waitFor(() => expect(requests).toEqual(oneMoreRefresh(before)));
    await waitForMutationsIdle(rendered.client);
  });

  it('folds a burst of frames into one refresh', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = boardEndpoints();
    const rendered = await renderQuietBoard(stream);
    const before = { ...requests };

    for (let frame = 0; frame < 5; frame += 1) stream.push();
    await advance(rendered.client, WITHIN_A_SECOND_MS);

    await waitFor(() => expect(requests).toEqual(oneMoreRefresh(before)));
    await advance(rendered.client, PAST_ONE_REFRESH_GAP_MS);
    expect(requests).toEqual(oneMoreRefresh(before));
    await waitForMutationsIdle(rendered.client);
  });

  it('refreshes a busy board no more often than it polls without a stream, however fast frames arrive', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = boardEndpoints();
    const rendered = await renderQuietBoard(stream);
    const before = { ...requests };

    for (let frame = 0; frame < 32; frame += 1) {
      stream.push();
      await act(() => vi.advanceTimersByTimeAsync(250));
    }
    await advance(rendered.client, PAST_ONE_REFRESH_GAP_MS);

    expect(requests).toEqual(moreRefreshes(before, 3));
    await waitForMutationsIdle(rendered.client);
  });

  it('still lands a card change while frames keep arriving and the board reads slower than it refreshes', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { board } = boardEndpoints();
    const rendered = await renderQuietBoard(stream);
    board.title = 'Fix logout';
    board.readMs = BOARD_READ_SLOWER_THAN_THE_REFRESH_GAP_MS;

    for (let frame = 0; frame < 20; frame += 1) {
      stream.push();
      await act(() => vi.advanceTimersByTimeAsync(1_000));
    }

    await waitFor(() => expect(rendered.result.current.cards.data?.[0]?.title).toBe('Fix logout'));
    board.readMs = 0;
    await advance(rendered.client, BOARD_READ_SLOWER_THAN_THE_REFRESH_GAP_MS + PAST_ONE_REFRESH_GAP_MS);
    await waitForMutationsIdle(rendered.client);
  });

  it('reads nothing but the safety re-read on a board idle for minutes, then polls once the stream drops', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = boardEndpoints();
    const rendered = await renderQuietBoard(stream);
    const connected = { ...requests };

    for (let ping = 0; ping < FIVE_MINUTES_OF_SERVER_PINGS; ping += 1) {
      stream.ping();
      await advance(rendered.client, SERVER_PING_EVERY_MS);
    }
    // Runs have no timer of their own: they are read with the board, at most once a minute.
    const safetyRereads = requests.runs - connected.runs;
    expect(safetyRereads).toBeLessThanOrEqual(5);
    expect(requests).toEqual(moreRefreshes(connected, safetyRereads));

    server.use(http.get(FEED_URL, () => new HttpResponse(null, { status: 503 })));
    stream.close();
    await waitFor(() => expect(stream.open).toBe(false));
    const dropped = { ...requests };

    await advance(rendered.client, PAST_ONE_FALLBACK_POLL_MS);
    await waitFor(() => {
      expect(requests.cards).toBeGreaterThan(dropped.cards);
      expect(requests.decisions).toBeGreaterThan(dropped.decisions);
      expect(requests.runs).toBeGreaterThan(dropped.runs);
    });
  });

  it('shows what changed while the stream was down as soon as it is back, ahead of any poll', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { board } = boardEndpoints();
    const rendered = await renderQuietBoard(stream);

    stream.close();
    await waitFor(() => expect(stream.open).toBe(false));
    board.title = 'Fix logout';
    await advance(rendered.client, PAST_ONE_STREAM_RETRY_MS);
    await waitFor(() => expect(stream.open).toBe(true));
    await advance(rendered.client, WITHIN_A_SECOND_MS);

    await waitFor(() => expect(rendered.result.current.cards.data?.[0]?.title).toBe('Fix logout'));
    await waitForMutationsIdle(rendered.client);
  });

  it('re-reads a board the page still held from before its stream opened', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests, board } = boardEndpoints();
    const client = createQueryClient();
    client.setQueryData(queryKeys.workItems(PROJECT_ID), boardSnapshot('Fix login'));
    board.title = 'Fix logout';

    const rendered = await renderConnectedBoard(stream, client);
    await advance(rendered.client, WITHIN_A_SECOND_MS);

    await waitFor(() => expect(rendered.result.current.cards.data?.[0]?.title).toBe('Fix logout'));
    expect(requests.cards).toBe(1);
    await waitForMutationsIdle(rendered.client);
  });

  it('keeps a card in the column it is moving to when a frame lands before the move settles', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests, board } = boardEndpoints();
    const settleMove = heldCardMove(board);
    const rendered = await renderQuietBoard(stream);
    const shownStages = () => rendered.result.current.cards.data?.[0]?.stages;
    const [item] = rendered.result.current.cards.data ?? [];
    if (!item) throw new Error('the board never loaded its card');

    act(() => rendered.result.current.move.mutate({ item, board: 'review', stage: 'review' }));
    await waitFor(() => expect(shownStages()).toEqual(['review']));
    const moving = { ...requests };
    stream.push();
    await advance(rendered.client, WITHIN_A_SECOND_MS);
    expect(shownStages()).toEqual(['review']);

    settleMove();
    await waitFor(() => expect(rendered.result.current.move.isSuccess).toBe(true));
    await advance(rendered.client, WITHIN_A_SECOND_MS);
    await waitFor(() => expect(requests.runs).toBeGreaterThan(moving.runs));
    expect(shownStages()).toEqual(['review']);
    await waitForMutationsIdle(rendered.client);
  });

  it('keeps a card in the column it is moving to when a poll comes round before the move settles', async () => {
    server.use(http.get(FEED_URL, () => new HttpResponse(null, { status: 404 })));
    const { board } = boardEndpoints();
    const settleMove = heldCardMove(board);
    const rendered = renderHookWithProviders(watchBoard, { inner });
    await waitFor(() => expect(rendered.result.current.cards.isSuccess).toBe(true));
    const shownStages = () => rendered.result.current.cards.data?.[0]?.stages;
    const [item] = rendered.result.current.cards.data ?? [];
    if (!item) throw new Error('the board never loaded its card');

    act(() => rendered.result.current.move.mutate({ item, board: 'review', stage: 'review' }));
    await waitFor(() => expect(shownStages()).toEqual(['review']));
    await advance(rendered.client, PAST_ONE_FALLBACK_POLL_MS);
    expect(shownStages()).toEqual(['review']);

    settleMove();
    await waitFor(() => expect(rendered.result.current.move.isSuccess).toBe(true));
    await advance(rendered.client, PAST_ONE_FALLBACK_POLL_MS);
    expect(shownStages()).toEqual(['review']);
    await waitForMutationsIdle(rendered.client);
  });

  it('keeps reading decisions while a card move hangs, and leaves the card where it is going', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests, board } = boardEndpoints();
    const settleMove = heldCardMove(board);
    const rendered = await renderQuietBoard(stream);
    const shownStages = () => rendered.result.current.cards.data?.[0]?.stages;
    const [item] = rendered.result.current.cards.data ?? [];
    if (!item) throw new Error('the board never loaded its card');

    act(() => rendered.result.current.move.mutate({ item, board: 'review', stage: 'review' }));
    await waitFor(() => expect(shownStages()).toEqual(['review']));
    const moving = { ...requests };
    for (let frame = 0; frame < 3; frame += 1) {
      stream.push();
      await advance(rendered.client, PAST_ONE_REFRESH_GAP_MS);
    }

    expect(requests).toEqual({ ...moreRefreshes(moving, 3), cards: moving.cards });
    expect(shownStages()).toEqual(['review']);
    settleMove();
    await waitForMutationsIdle(rendered.client);
  });

  it('keeps reading decisions while a card read hangs, then reads the cards once more when it ends', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = boardEndpoints();
    const rendered = await renderQuietBoard(stream);
    let releaseCards = () => {};
    const cardsHeld = new Promise<void>(resolve => {
      releaseCards = resolve;
    });
    server.use(
      http.get(BOARD_URL, async () => {
        requests.cards += 1;
        await cardsHeld;
        return HttpResponse.json(boardSnapshot('Fix login'));
      }),
    );
    const before = { ...requests };

    for (let frame = 0; frame < 3; frame += 1) {
      stream.push();
      await act(() => vi.advanceTimersByTimeAsync(PAST_ONE_REFRESH_GAP_MS));
    }

    await waitFor(() => expect(requests.decisions).toBe(before.decisions + 3));
    // The held read is never cancelled for a newer one; one more waits behind it.
    expect(requests.cards).toBe(before.cards + 1);
    releaseCards();
    await waitFor(() => expect(requests.cards).toBe(before.cards + 2));
    await waitForMutationsIdle(rendered.client);
  });

  it('reopens a stream that has gone silent, the way a dead server leaves it', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    boardEndpoints();
    const rendered = await renderQuietBoard(stream);

    await advance(rendered.client, PAST_THE_SILENCE_A_LIVE_STREAM_ALLOWS_MS);
    await advance(rendered.client, PAST_ONE_STREAM_RETRY_MS);

    await waitFor(() => expect(stream.opens).toBe(2));
    await waitFor(() => expect(stream.open).toBe(true));
    await waitForMutationsIdle(rendered.client);
  });

  it('keeps a quiet stream open as long as the server keeps pinging it', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    boardEndpoints();
    const rendered = await renderQuietBoard(stream);

    for (let ping = 0; ping < 4; ping += 1) {
      stream.ping();
      await advance(rendered.client, SERVER_PING_EVERY_MS);
    }

    expect(stream.opens).toBe(1);
    expect(stream.open).toBe(true);
    await waitForMutationsIdle(rendered.client);
  });
});

describe('FeedEventsProvider, on a session page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps a session’s card current, change after change, while the board read hangs', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    const shown = { title: 'Fix login' };
    let releaseBoard = () => {};
    const boardHeld = new Promise<void>(resolve => {
      releaseBoard = resolve;
    });
    server.use(
      stream.handler,
      http.get(BOARD_URL, async ({ request }) => {
        const snapshot = boardSnapshot(shown.title);
        if (!new URL(request.url).searchParams.has('sessionId')) await boardHeld;
        return HttpResponse.json(snapshot);
      }),
    );
    // The sidebar reads the whole board on a session page; the header reads the session's cards.
    const rendered = renderHookWithProviders(
      () => ({ board: useWorkItemsQuery(PROJECT_ID), session: useSessionWorkItemsQuery(PROJECT_ID, 'session-1') }),
      { inner },
    );
    await waitFor(() => expect(stream.open).toBe(true));
    const sessionCardTitle = () => rendered.result.current.session.data?.[0]?.title;
    await waitFor(() => expect(sessionCardTitle()).toBe('Fix login'));

    for (const title of ['Fix logout', 'Fix signup']) {
      shown.title = title;
      stream.push();
      await act(() => vi.advanceTimersByTimeAsync(PAST_ONE_REFRESH_GAP_MS));
      await waitFor(() => expect(sessionCardTitle()).toBe(title));
    }

    releaseBoard();
    await advance(rendered.client, PAST_ONE_REFRESH_GAP_MS);
    await waitForMutationsIdle(rendered.client);
  });
});

describe('FeedEventsProvider, on a draft page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the starter counts and the activity current when the board changes', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    const board = { untriaged: 1, cards: 1 };
    server.use(
      stream.handler,
      http.get(`${BOARD_URL}/starters`, () =>
        HttpResponse.json({
          failed: 0,
          changesRequested: 0,
          review: { count: 0 },
          undecided: 0,
          untriaged: board.untriaged,
          unplannedBugs: 0,
          stale: 0,
        }),
      ),
      http.get(`${BOARD_URL}/activity`, () => HttpResponse.json({ total: board.cards, createdAt: [], doneAt: [] })),
    );
    const rendered = renderHookWithProviders(
      () => ({
        starters: useQuery(workItemStartersQueryOptions(TEST_BASE_URL, PROJECT_ID)),
        activity: useQuery(workItemActivityQueryOptions(TEST_BASE_URL, PROJECT_ID, 'week')),
      }),
      { inner },
    );
    await waitFor(() => expect(stream.open).toBe(true));
    const shown = () => ({
      untriaged: rendered.result.current.starters.data?.untriaged,
      cards: rendered.result.current.activity.data?.total,
    });
    await waitFor(() => expect(shown()).toEqual({ untriaged: 1, cards: 1 }));
    await advance(rendered.client, PAST_ONE_REFRESH_GAP_MS);

    board.untriaged = 2;
    board.cards = 2;
    stream.push();
    await advance(rendered.client, WITHIN_A_SECOND_MS);

    await waitFor(() => expect(shown()).toEqual({ untriaged: 2, cards: 2 }));
    await waitForMutationsIdle(rendered.client);
  });

  it('stops asking a server too old to count starters or activity, while frames keep refreshing the rest', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    const { requests } = boardEndpoints();
    const counted = { starters: 0, activity: 0 };
    server.use(
      stream.handler,
      http.get(`${BOARD_URL}/starters`, () => {
        counted.starters += 1;
        return HttpResponse.json({ error: 'not_found' }, { status: 404 });
      }),
      http.get(`${BOARD_URL}/activity`, () => {
        counted.activity += 1;
        return HttpResponse.json({ error: 'not_found' }, { status: 404 });
      }),
    );
    const rendered = renderHookWithProviders(
      () => ({
        starters: useQuery(workItemStartersQueryOptions(TEST_BASE_URL, PROJECT_ID)),
        activity: useQuery(workItemActivityQueryOptions(TEST_BASE_URL, PROJECT_ID, 'week')),
        decisions: useFactoryDecisionStatus(PROJECT_ID, ['pending', 'leased']),
      }),
      { inner },
    );
    await waitFor(() => expect(stream.open).toBe(true));
    await waitFor(() => {
      expect(rendered.result.current.starters.isError).toBe(true);
      expect(rendered.result.current.activity.isError).toBe(true);
    });
    await advance(rendered.client, PAST_ONE_REFRESH_GAP_MS);
    const before = { ...counted, decisions: requests.decisions };

    for (let frame = 0; frame < 2; frame += 1) {
      stream.push();
      await advance(rendered.client, PAST_ONE_REFRESH_GAP_MS);
    }

    expect(requests.decisions).toBe(before.decisions + 2);
    expect(counted).toEqual({ starters: before.starters, activity: before.activity });
    await waitForMutationsIdle(rendered.client);
  });
});
