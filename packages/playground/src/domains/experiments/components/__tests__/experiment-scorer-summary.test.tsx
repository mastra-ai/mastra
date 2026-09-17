import type { ClientScoreRowData, GetScorerResponse } from '@mastra/client-js';
import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExperimentScorerSummary } from '../experiment-scorer-summary';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '@/test/render';

const scorer = (name: string): GetScorerResponse =>
  ({
    scorer: { config: { id: name, name, description: `${name} description` } },
    source: 'code',
    agentIds: [],
    workflowIds: [],
  }) as unknown as GetScorerResponse;

const scorers: Record<string, GetScorerResponse> = {
  'answer-relevancy': scorer('answer-relevancy'),
  toxicity: scorer('toxicity'),
};

const score = (scorerId: string, value: number): ClientScoreRowData =>
  ({ scorerId, score: value }) as ClientScoreRowData;

const scoresByItemId: Record<string, ClientScoreRowData[]> = {
  'item-1': [score('answer-relevancy', 0.5), score('toxicity', 1)],
  'item-2': [score('answer-relevancy', 1)],
};

const renderSummary = (props: Parameters<typeof ExperimentScorerSummary>[0]) =>
  renderWithProviders(
    <TestLinkProvider>
      <ExperimentScorerSummary {...props} />
    </TestLinkProvider>,
  );

describe('ExperimentScorerSummary', () => {
  afterEach(cleanup);

  beforeEach(() => {
    server.use(http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(scorers)));
  });

  it('renders a metric card per scorer', async () => {
    const { queryClient } = renderSummary({ scoresByItemId });

    // answer-relevancy: avg (0.5 + 1) / 2 = 0.750 over 2 scored items.
    expect(screen.getByText('0.750')).toBeDefined();

    // toxicity: avg 1.000 over a single scored item.
    expect(screen.getByText('1.000')).toBeDefined();

    // The scored-item count is not surfaced — the card only carries the score.
    expect(screen.queryByText(/items? scored/)).toBeNull();

    // The icon is labelled so hovering it explains what the link points at.
    expect(screen.getAllByRole('img', { name: 'Scorer' })).toHaveLength(2);

    // No invented pass/fail verdict.
    expect(screen.queryByText('failed')).toBeNull();

    await waitForMutationsIdle(queryClient);
  });

  it('links each card to its scorer page', async () => {
    const { queryClient } = renderSummary({ scoresByItemId });

    const link = await screen.findByText('answer-relevancy');
    expect(link.closest('a')?.getAttribute('href')).toBe('/scorers/answer-relevancy');
    expect(link.closest('a')?.hasAttribute('target')).toBe(false);

    await waitForMutationsIdle(queryClient);
  });

  it('shows the empty state when no scores exist', async () => {
    const { queryClient } = renderSummary({ scoresByItemId: {} });

    expect(await screen.findByText('No scorers configured')).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });
});
