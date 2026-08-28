// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { TraceScoresCollapsible } from '../trace-scores-collapsible';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';

const TEST_BASE_URL = 'http://localhost:4111';

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={TEST_BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TestLinkProvider>{children}</TestLinkProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

afterEach(() => cleanup());

const scores = {
  scores: [
    {
      id: 'score-1',
      score: 0.4,
      scorerId: 'relevance-scorer',
      entityId: 'agent-1',
      scorer: { id: 'relevance-scorer', name: 'Relevance' },
      traceId: 'trace-a',
      spanId: 'span-a',
      createdAt: new Date('2026-07-31T12:00:02.000Z'),
    },
    {
      id: 'score-2',
      score: 1,
      scorerId: 'toxicity-scorer',
      entityId: 'agent-1',
      scorer: { id: 'toxicity-scorer', name: 'Toxicity' },
      traceId: 'trace-a',
      spanId: 'span-a',
      createdAt: new Date('2026-07-31T12:00:03.000Z'),
    },
  ],
  pagination: { total: 2, page: 0, perPage: 10, hasMore: false },
};

const respondWith = (body: unknown) =>
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/:spanId/scores`, () => HttpResponse.json(body)),
  );

describe('TraceScoresCollapsible', () => {
  it('summarises the trace scores and reveals them on demand', async () => {
    respondWith(scores);

    render(<TraceScoresCollapsible traceId="trace-a" spanId="span-a" />, { wrapper });

    const trigger = await screen.findByRole('button', { name: /2 scores/i });
    // Collapsed by default: the enriched thread stays readable until scores are asked for.
    expect(screen.queryByText('Relevance')).toBeNull();

    fireEvent.click(trigger);

    // Several scores: the chart plots them, and the list names them, so both say 'Relevance'.
    expect(await screen.findAllByText('Relevance')).toHaveLength(2);
    expect(screen.getAllByText('Toxicity')).toHaveLength(2);
    // The name opens the scorer, in a new tab so the thread stays where it is.
    const scorerLink = screen.getByRole('link', { name: /Relevance/ });
    expect(scorerLink.getAttribute('href')).toBe('/scorers/relevance-scorer');
    expect(scorerLink.getAttribute('target')).toBe('_blank');

    // The chart reads the same scores, so its averages are there too.
    expect(screen.getByText('0.40')).toBeDefined();
    expect(screen.getByText('1.00')).toBeDefined();

    // The value opens that very score on it.
    const scoreLink = screen.getByRole('link', { name: /0.4/ });
    expect(scoreLink.getAttribute('href')).toBe('/scorers/relevance-scorer?entity=agent-1&scoreId=score-1');
    expect(scoreLink.getAttribute('target')).toBe('_blank');
  });

  it('offers to score a turn that has never been scored', async () => {
    respondWith({ scores: [], pagination: { total: 0, page: 0, perPage: 10, hasMore: false } });

    render(<TraceScoresCollapsible traceId="trace-a" spanId="span-a" />, { wrapper });

    // Unscored is still worth a disclosure: expanding it is how the turn gets scored.
    const trigger = await screen.findByRole('button', { name: /No score/i });
    fireEvent.click(trigger);

    expect(await screen.findByRole('button', { name: /Score trace/i })).toBeDefined();
  });

  it('still offers to score when the scores cannot be loaded', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/:spanId/scores`, () =>
        HttpResponse.json({ error: 'nope' }, { status: 500 }),
      ),
    );

    render(<TraceScoresCollapsible traceId="trace-a" spanId="span-a" />, { wrapper });

    fireEvent.click(await screen.findByRole('button', { name: /No score/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /Score trace/i })).toBeDefined());
  });
});
