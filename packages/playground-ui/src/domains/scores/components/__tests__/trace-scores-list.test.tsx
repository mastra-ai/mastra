// @vitest-environment jsdom
import type { ClientScoreRowData, ListScoresResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TraceScoresList } from '../trace-scores-list';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const SCORES_URL = `${BASE_URL}/api/observability/traces/trace-1/root/scores`;

afterEach(() => cleanup());

function buildScore(overrides: Partial<ClientScoreRowData>): ClientScoreRowData {
  return {
    id: 'score-1',
    scorerId: 'answer-relevancy',
    entityId: 'agent-1',
    runId: 'run-1',
    score: 0.5,
    scorer: { name: 'Answer relevancy' },
    source: 'LIVE',
    entity: {},
    traceId: 'trace-1',
    spanId: 'root',
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: null,
    ...overrides,
  };
}

function scoresResponse(scores: ClientScoreRowData[], hasMore = false): ListScoresResponse {
  return { scores, pagination: { total: scores.length, page: 0, perPage: 10, hasMore } };
}

function renderList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onScoreSelect = vi.fn();

  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TraceScoresList traceId="trace-1" spanId="root" onScoreSelect={onScoreSelect} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  return { onScoreSelect };
}

describe('TraceScoresList', () => {
  it('lists each scorer against its formatted score', async () => {
    server.use(
      http.get(SCORES_URL, () =>
        HttpResponse.json(
          scoresResponse([
            buildScore({ id: 'score-1', score: 0.8567 }),
            buildScore({ id: 'score-2', scorerId: 'toxicity', scorer: {}, score: 0 }),
          ]),
        ),
      ),
    );
    renderList();

    const terms = await screen.findAllByRole('term');
    expect(terms.map(term => term.textContent)).toEqual(['Answer relevancy', 'toxicity']);
    expect(screen.getAllByRole('definition').map(value => value.textContent)).toEqual(['0.86', '0.00']);
  });

  it('opens the score that was clicked', async () => {
    server.use(http.get(SCORES_URL, () => HttpResponse.json(scoresResponse([buildScore({ id: 'score-42' })]))));
    const { onScoreSelect } = renderList();

    await userEvent.click(await screen.findByRole('button', { name: 'Open Answer relevancy score' }));

    expect(onScoreSelect).toHaveBeenCalledWith('score-42');
  });

  it('offers the reason on hover only for scores that have one', async () => {
    server.use(
      http.get(SCORES_URL, () =>
        HttpResponse.json(
          scoresResponse([
            buildScore({ id: 'score-1', reason: 'The answer stays **on topic**.' }),
            buildScore({ id: 'score-2', scorerId: 'toxicity', scorer: {}, reason: '  ' }),
          ]),
        ),
      ),
    );
    renderList();

    const [withReason, withoutReason] = await screen.findAllByRole('definition');
    expect(within(withoutReason).queryByRole('button')).toBeNull();

    await userEvent.hover(within(withReason).getByRole('button', { name: 'Show Answer relevancy reason' }));
    expect(await screen.findByText('on topic')).toBeTruthy();
  });

  it('says there is nothing yet when the span has no scores', async () => {
    server.use(http.get(SCORES_URL, () => HttpResponse.json(scoresResponse([]))));
    renderList();

    expect(await screen.findByText('No scores yet. Score this trace to see results here.')).toBeTruthy();
  });

  it('pages through the scores when there are more', async () => {
    server.use(
      http.get(SCORES_URL, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? 0);
        const response =
          page === 0
            ? scoresResponse([buildScore({ id: 'score-1' })], true)
            : scoresResponse([buildScore({ id: 'score-2', scorerId: 'toxicity', scorer: {} })]);
        return HttpResponse.json({ ...response, pagination: { ...response.pagination, page } });
      }),
    );
    renderList();

    await screen.findByText('Answer relevancy');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(await screen.findByText('toxicity')).toBeTruthy();
    expect(screen.queryByText('Answer relevancy')).toBeNull();
  });
});
