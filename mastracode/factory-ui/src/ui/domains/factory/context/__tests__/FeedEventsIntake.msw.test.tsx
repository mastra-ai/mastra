// @vitest-environment jsdom
import type { QueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pushableFeedStream } from '../../../../../../e2e/ui/feed-stream';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { useIntakeCandidatesQuery } from '../../../../../hooks/useIntakeCandidates';
import { useSidebarWorkItemsQuery } from '../../../../../hooks/useWorkItems';
import { githubIssueRecord } from '../../../../__tests__/fixtures/intakeCandidates';
import { HIDDEN_STREAM_GRACE_MS } from '../../../../lib/hooks/useDocumentVisible';
import { FeedEventsProvider } from '../FeedEventsProvider';

const PROJECT_ID = 'project-1';
const BOARD_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`;
const CANDIDATES_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/intake/candidates`;
const WITHIN_A_SECOND_MS = 900;
const PAST_ONE_REFRESH_GAP_MS = 6_000;
const PAST_ONE_STREAM_RETRY_MS = 3_100;
const SERVER_PING_EVERY_MS = 25_000;
const FIVE_MINUTES_OF_SERVER_PINGS = 12;

function inner({ children }: { children: React.ReactNode }) {
  return <FeedEventsProvider factoryProjectId={PROJECT_ID}>{children}</FeedEventsProvider>;
}

function watchBoard() {
  const candidates = useIntakeCandidatesQuery(PROJECT_ID);
  return {
    cards: useSidebarWorkItemsQuery(PROJECT_ID),
    candidates,
    listed: candidates.data?.pages.flatMap(page => page.candidates.map(({ key }) => key)),
  };
}

function watchCardsOnly() {
  return { cards: useSidebarWorkItemsQuery(PROJECT_ID) };
}

function endpoints() {
  const requests = { cards: 0, candidates: 0 };
  const list = { issues: [1] };
  server.use(
    http.get(BOARD_URL, () => {
      requests.cards += 1;
      return HttpResponse.json({ workItems: [], runningSessionIds: [], parkedSessionIds: [] });
    }),
    http.get(CANDIDATES_URL, () => {
      requests.candidates += 1;
      return HttpResponse.json({ candidates: list.issues.map(number => githubIssueRecord(number)), passes: [] });
    }),
  );
  return { requests, list };
}

async function advance(client: QueryClient, ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
  await waitFor(() => expect(client.isFetching()).toBe(0));
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

type FeedStream = ReturnType<typeof pushableFeedStream>;

async function renderQuietBoard(stream: FeedStream) {
  const rendered = renderHookWithProviders(watchBoard, { inner });
  await waitFor(() => expect(stream.open).toBe(true));
  await waitFor(() => expect(rendered.result.current.candidates.isSuccess).toBe(true));
  await advance(rendered.client, PAST_ONE_REFRESH_GAP_MS);
  await waitForMutationsIdle(rendered.client);
  return rendered;
}

describe('FeedEventsProvider, on the items with no card', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    setVisibility('visible');
  });

  it('asks for the list once when a board opens, stream and all', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = endpoints();

    await renderQuietBoard(stream);

    expect(requests.candidates).toBe(1);
  });

  it('shows what an intake frame announced within a second, and reads no cards for it', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests, list } = endpoints();
    const rendered = await renderQuietBoard(stream);
    const quiet = { ...requests };

    list.issues = [2, 1];
    stream.pushIntake();
    await advance(rendered.client, WITHIN_A_SECOND_MS);

    await waitFor(() => expect(rendered.result.current.listed).toEqual(['acme/repo#2', 'acme/repo#1']));
    expect(requests).toEqual({ cards: quiet.cards, candidates: quiet.candidates + 1 });
  });

  it('asks for no list when only a card changed', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = endpoints();
    const rendered = await renderQuietBoard(stream);
    const quiet = { ...requests };

    stream.push();
    await advance(rendered.client, PAST_ONE_REFRESH_GAP_MS);

    expect(requests).toEqual({ cards: quiet.cards + 1, candidates: quiet.candidates });
  });

  it('shows a card change within a second while a pass is announcing candidates', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = endpoints();
    const rendered = await renderQuietBoard(stream);
    stream.pushIntake();
    await advance(rendered.client, WITHIN_A_SECOND_MS);
    const afterIntake = { ...requests };

    stream.push();
    await advance(rendered.client, WITHIN_A_SECOND_MS);

    expect(requests).toEqual({ cards: afterIntake.cards + 1, candidates: afterIntake.candidates });
  });

  it('folds the frames of one pass into one read', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = endpoints();
    const rendered = await renderQuietBoard(stream);
    const quiet = requests.candidates;

    for (let frame = 0; frame < 20; frame += 1) stream.pushIntake();
    await advance(rendered.client, PAST_ONE_REFRESH_GAP_MS);

    expect(requests.candidates).toBe(quiet + 1);
  });

  it('reads the list no more often than a board without a stream polls, however long a pass keeps announcing', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = endpoints();
    const rendered = await renderQuietBoard(stream);
    const quiet = requests.candidates;

    for (let frame = 0; frame < 20; frame += 1) {
      stream.pushIntake();
      await advance(rendered.client, 500);
    }

    expect(requests.candidates - quiet).toBeLessThanOrEqual(3);
    expect(requests.candidates - quiet).toBeGreaterThanOrEqual(2);
  });

  it('reads nothing but the safety re-read on a board idle for minutes', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = endpoints();
    const rendered = await renderQuietBoard(stream);
    const quiet = requests.candidates;

    for (let ping = 0; ping < FIVE_MINUTES_OF_SERVER_PINGS; ping += 1) {
      stream.ping();
      await advance(rendered.client, SERVER_PING_EVERY_MS);
    }

    expect(requests.candidates - quiet).toBeLessThanOrEqual(5);
    expect(requests.candidates - quiet).toBeGreaterThanOrEqual(4);
  });

  it('shows what changed while the stream was down as soon as it is back', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests, list } = endpoints();
    const rendered = await renderQuietBoard(stream);
    const quiet = requests.candidates;

    stream.close();
    await waitFor(() => expect(stream.open).toBe(false));
    list.issues = [];
    await advance(rendered.client, PAST_ONE_STREAM_RETRY_MS);
    await waitFor(() => expect(stream.open).toBe(true));
    await advance(rendered.client, PAST_ONE_REFRESH_GAP_MS);

    await waitFor(() => expect(rendered.result.current.listed).toEqual([]));
    expect(requests.candidates).toBe(quiet + 1);
  });

  it('asks nothing from a tab left hidden, and catches up once when it is looked at again', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests, list } = endpoints();
    const rendered = await renderQuietBoard(stream);
    const quiet = requests.candidates;

    act(() => setVisibility('hidden'));
    act(() => vi.advanceTimersByTime(HIDDEN_STREAM_GRACE_MS));
    list.issues = [3];
    await advance(rendered.client, 5 * 60_000);
    expect(requests.candidates).toBe(quiet);

    act(() => setVisibility('visible'));
    await waitFor(() => expect(stream.opens).toBe(2));
    await advance(rendered.client, PAST_ONE_REFRESH_GAP_MS);

    await waitFor(() => expect(rendered.result.current.listed).toEqual(['acme/repo#3']));
    expect(requests.candidates).toBe(quiet + 1);
  });

  it('asks for no list from a page that shows none', async () => {
    const stream = pushableFeedStream(PROJECT_ID);
    server.use(stream.handler);
    const { requests } = endpoints();
    const rendered = renderHookWithProviders(watchCardsOnly, { inner });
    await waitFor(() => expect(stream.open).toBe(true));
    await waitFor(() => expect(rendered.result.current.cards.isSuccess).toBe(true));

    stream.pushIntake();
    await advance(rendered.client, 2 * 60_000);

    expect(requests.candidates).toBe(0);
    await waitForMutationsIdle(rendered.client);
  });
});
