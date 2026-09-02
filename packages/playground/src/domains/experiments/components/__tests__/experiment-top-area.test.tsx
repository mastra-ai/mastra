import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExperimentTopArea } from '../experiment-top-area';
import { experiments, noAgents, noProcessors, noWorkflows, noScorers } from './fixtures/experiments';
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
      http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
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

  it('titles the page with the run itself', async () => {
    const { queryClient } = renderWithProviders(
      <TestLinkProvider>
        <ExperimentTopArea experiment={namedExperiment} />
      </TestLinkProvider>,
      { router: true },
    );

    // The run is the subject of the page; the dataset it ran on lives in the flow chain.
    expect(await screen.findByText(`Experiment #${namedExperiment.id.slice(0, 8)}`)).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });

  it('walks through the dataset, the target and the scorers', async () => {
    const { queryClient } = renderWithProviders(
      <TestLinkProvider>
        <ExperimentTopArea experiment={namedExperiment} />
      </TestLinkProvider>,
      { router: true },
    );

    const datasetLink = await screen.findByRole('link', { name: new RegExp(namedExperiment.datasetId!) });
    expect(datasetLink.getAttribute('href')).toBe(`/datasets/${namedExperiment.datasetId}`);

    const target = await screen.findByRole('link', { name: /example-entity-extraction-agent/ });
    expect(target.getAttribute('href')).toContain('example-entity-extraction-agent');

    // Two distinct scorers produced the mocked scores.
    expect(await screen.findByText('2 scorers')).toBeDefined();
    expect(screen.getByText('each item')).toBeDefined();
    expect(screen.getByText('comparing ground truth')).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });

  it('shows the description when the experiment has one', async () => {
    const { queryClient } = renderWithProviders(
      <TestLinkProvider>
        <ExperimentTopArea experiment={namedExperiment} />
      </TestLinkProvider>,
      { router: true },
    );

    expect(await screen.findByText(namedExperiment.description!)).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });

  it('omits the description when the experiment has none', async () => {
    const { queryClient } = renderWithProviders(
      <TestLinkProvider>
        <ExperimentTopArea experiment={unnamedExperiment} />
      </TestLinkProvider>,
      { router: true },
    );

    expect(await screen.findByText(`Experiment #${unnamedExperiment.id.slice(0, 8)}`)).toBeDefined();
    expect(screen.queryByText(namedExperiment.description!)).toBeNull();

    await waitForMutationsIdle(queryClient);
  });
});
