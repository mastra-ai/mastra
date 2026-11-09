// @vitest-environment jsdom
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
import { useTransitionWorkItemMutation, useWorkItemsQuery } from '../../../../../hooks/useWorkItems';
import { createQueryClient } from '../../../../../query-client';
import { AGENT_CONTROLLER_ID } from '../../../chat/services/constants';
import { FeedEventsProvider, useFeedEventsConnected } from '../FeedEventsProvider';

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
    connected: useFeedEventsConnected(),
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

function oneMoreOfEach(requests: BoardRequests): BoardRequests {
  return { cards: requests.cards + 1, decisions: requests.decisions + 1, runs: requests.runs + 1 };
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

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
  await delay(50);
}

async function renderConnectedBoard(client?: QueryClient) {
  const rendered = renderHookWithProviders(watchBoard, { inner, client });
  await waitFor(() => expect(rendered.result.current.connected).toBe(true));
  await waitFor(() => expect(rendered.result.current.cards.isSuccess).toBe(true));
  return rendered;
}

async function renderQuietBoard() {
  const rendered = await renderConnectedBoard();
  await advance(PAST_ONE_REFRESH_GAP_MS);
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
    const rendered = await renderQuietBoard();
    const before = { ...requests };

    stream.push();
    await advance(WITHIN_A_SECOND_MS);

    await waitFor(() => expect(requests).toEqual(oneMoreOfEach(before)));
    await waitForMutationsIdle(rendered.client);
  });

  it('folds a burst of frames into one refresh', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = boardEndpoints();
    const rendered = await renderQuietBoard();
    const before = { ...requests };

    for (let frame = 0; frame < 5; frame += 1) stream.push();
    await advance(WITHIN_A_SECOND_MS);

    await waitFor(() => expect(requests).toEqual(oneMoreOfEach(before)));
    await advance(PAST_ONE_REFRESH_GAP_MS);
    expect(requests).toEqual(oneMoreOfEach(before));
    await waitForMutationsIdle(rendered.client);
  });

  it('refreshes a busy board no more often than it polls without a stream, however fast frames arrive', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = boardEndpoints();
    const rendered = await renderQuietBoard();
    const before = { ...requests };

    for (let frame = 0; frame < 32; frame += 1) {
      stream.push();
      await act(() => vi.advanceTimersByTimeAsync(250));
      await delay(0);
    }
    await advance(PAST_ONE_REFRESH_GAP_MS);

    expect(requests).toEqual({ cards: before.cards + 3, decisions: before.decisions + 3, runs: before.runs + 3 });
    await waitForMutationsIdle(rendered.client);
  });

  it('still lands a card change while frames keep arriving and the board reads slower than it refreshes', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { board } = boardEndpoints();
    const rendered = await renderQuietBoard();
    board.title = 'Fix logout';
    board.readMs = BOARD_READ_SLOWER_THAN_THE_REFRESH_GAP_MS;

    for (let frame = 0; frame < 20; frame += 1) {
      stream.push();
      await act(() => vi.advanceTimersByTimeAsync(1_000));
      await delay(0);
    }

    await waitFor(() => expect(rendered.result.current.cards.data?.[0]?.title).toBe('Fix logout'));
    board.readMs = 0;
    await advance(BOARD_READ_SLOWER_THAN_THE_REFRESH_GAP_MS + PAST_ONE_REFRESH_GAP_MS);
    await waitForMutationsIdle(rendered.client);
  });

  it('polls nothing while the stream is up, then polls again once it drops', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = boardEndpoints();
    const rendered = await renderQuietBoard();
    const connected = { ...requests };

    await advance(PAST_ONE_FALLBACK_POLL_MS);
    expect(requests).toEqual(connected);

    server.use(http.get(FEED_URL, () => new HttpResponse(null, { status: 503 })));
    stream.close();
    await waitFor(() => expect(rendered.result.current.connected).toBe(false));
    const dropped = { ...requests };

    await advance(PAST_ONE_FALLBACK_POLL_MS);
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
    const rendered = await renderQuietBoard();

    stream.close();
    await waitFor(() => expect(rendered.result.current.connected).toBe(false));
    board.title = 'Fix logout';
    await advance(PAST_ONE_STREAM_RETRY_MS);
    await waitFor(() => expect(rendered.result.current.connected).toBe(true));
    await advance(WITHIN_A_SECOND_MS);

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

    const rendered = await renderConnectedBoard(client);
    await advance(WITHIN_A_SECOND_MS);

    await waitFor(() => expect(rendered.result.current.cards.data?.[0]?.title).toBe('Fix logout'));
    expect(requests.cards).toBe(1);
    await waitForMutationsIdle(rendered.client);
  });

  it('keeps a card in the column it is moving to when a frame lands before the move settles', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests, board } = boardEndpoints();
    let settleMove = () => {};
    const moveSettled = new Promise<void>(resolve => {
      settleMove = resolve;
    });
    server.use(
      http.post(`${BOARD_URL}/item-1/transition`, async () => {
        await moveSettled;
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
    const rendered = await renderQuietBoard();
    const shownStages = () => rendered.result.current.cards.data?.[0]?.stages;
    const [item] = rendered.result.current.cards.data ?? [];
    if (!item) throw new Error('the board never loaded its card');

    act(() => rendered.result.current.move.mutate({ item, board: 'review', stage: 'review' }));
    await waitFor(() => expect(shownStages()).toEqual(['review']));
    const moving = { ...requests };
    stream.push();
    await advance(WITHIN_A_SECOND_MS);
    expect(shownStages()).toEqual(['review']);

    settleMove();
    await waitFor(() => expect(rendered.result.current.move.isSuccess).toBe(true));
    await advance(WITHIN_A_SECOND_MS);
    await waitFor(() => expect(requests.runs).toBe(moving.runs + 1));
    expect(shownStages()).toEqual(['review']);
    await waitForMutationsIdle(rendered.client);
  });

  it('reopens a stream that has gone silent, the way a dead server leaves it', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    boardEndpoints();
    const rendered = await renderQuietBoard();

    await advance(PAST_THE_SILENCE_A_LIVE_STREAM_ALLOWS_MS);
    await advance(PAST_ONE_STREAM_RETRY_MS);

    await waitFor(() => expect(stream.opens).toBe(2));
    await waitFor(() => expect(rendered.result.current.connected).toBe(true));
    await waitForMutationsIdle(rendered.client);
  });

  it('keeps a quiet stream open as long as the server keeps pinging it', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    boardEndpoints();
    const rendered = await renderQuietBoard();

    for (let ping = 0; ping < 4; ping += 1) {
      stream.ping();
      await advance(SERVER_PING_EVERY_MS);
    }

    expect(stream.opens).toBe(1);
    expect(rendered.result.current.connected).toBe(true);
    await waitForMutationsIdle(rendered.client);
  });
});
