import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExperimentTopArea } from '../experiment-top-area';
import { experiments, noAgents, noWorkflows, noScorers } from './fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '@/test/render';

const namedExperiment = experiments[0];
const unnamedExperiment = experiments[2];

describe('ExperimentTopArea', () => {
  afterEach(cleanup);

  // The top area resolves its target through the agents/workflows/scorers
  // registries; empty registries mean the title falls back to the raw target id.
  beforeEach(() => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
      http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
      http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
      http.get(`${TEST_BASE_URL}/api/scores/run/:experimentId`, () =>
        HttpResponse.json({
          scores: [
            { entityId: 'item-1', scorerId: 'answer-relevancy', score: 0.5 },
            { entityId: 'item-2', scorerId: 'answer-relevancy', score: 1 },
            { entityId: 'item-2', scorerId: 'toxicity', score: 1 },
          ],
          pagination: { total: 3, page: 0, perPage: 100, hasMore: false },
        }),
      ),
      // The meta bar resolves the dataset name; a 404 falls back to the raw id.
      http.get(`${TEST_BASE_URL}/api/datasets/:datasetId`, () =>
        HttpResponse.json({ error: 'not found' }, { status: 404 }),
      ),
    );
  });

  it('shows the eyebrow label and the target as the page title, linked to the entity', async () => {
    const { queryClient } = renderWithProviders(
      <TestLinkProvider>
        <ExperimentTopArea experiment={namedExperiment} />
      </TestLinkProvider>,
    );

    expect(await screen.findByText('Evaluation target')).toBeDefined();
    expect(await screen.findByText('Avg 0.833')).toBeDefined();
    const title = await screen.findByRole('link', { name: /example-entity-extraction-agent/ });
    expect(title.getAttribute('href')).toContain('example-entity-extraction-agent');

    await waitForMutationsIdle(queryClient);
  });

  it('shows the description when the experiment has one', async () => {
    const { queryClient } = renderWithProviders(
      <TestLinkProvider>
        <ExperimentTopArea experiment={namedExperiment} />
      </TestLinkProvider>,
    );

    expect(await screen.findByText('Entity extraction evaluation using Model A')).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });

  it('omits the description when the experiment has none', async () => {
    const { queryClient } = renderWithProviders(
      <TestLinkProvider>
        <ExperimentTopArea experiment={unnamedExperiment} />
      </TestLinkProvider>,
    );

    expect(await screen.findByText('Evaluation target')).toBeDefined();
    expect(screen.queryByText(namedExperiment.description!)).toBeNull();

    await waitForMutationsIdle(queryClient);
  });
});
