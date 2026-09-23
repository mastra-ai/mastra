import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExperimentSideRail } from '../experiment-side-rail';
import { experiments, noAgents, noProcessors, noWorkflows, noScorers } from './fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '@/test/render';

const namedExperiment = experiments[0];

describe('ExperimentSideRail', () => {
  afterEach(cleanup);

  // The rail resolves its target through the agents/workflows/scorers
  // registries; empty registries mean the target falls back to the raw id.
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
      http.get(`${TEST_BASE_URL}/api/datasets/:datasetId`, () =>
        HttpResponse.json({ error: 'not found' }, { status: 404 }),
      ),
    );
  });

  it('walks through the dataset, the target and the scorers', async () => {
    const { queryClient } = renderWithProviders(
      <TestLinkProvider>
        <ExperimentSideRail experiment={namedExperiment} />
      </TestLinkProvider>,
      { router: true },
    );

    const datasetLink = await screen.findByRole('link', { name: new RegExp(namedExperiment.datasetId!) });
    expect(datasetLink.getAttribute('href')).toBe(`/datasets/${namedExperiment.datasetId}`);

    const target = await screen.findByRole('link', { name: /example-entity-extraction-agent/ });
    expect(target.getAttribute('href')).toContain('example-entity-extraction-agent');

    // Two distinct scorers produced the mocked scores; the registry is empty so ids stand in for names.
    expect(await screen.findByRole('link', { name: 'answer-relevancy' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'toxicity' })).toBeDefined();
    expect(screen.getByText('Each item will be passed to the agent')).toBeDefined();
    expect(screen.getByText('It gives a score by comparing ground truth')).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });

  it('groups the pipeline, the run and the scorers under headings', async () => {
    const { queryClient } = renderWithProviders(
      <TestLinkProvider>
        <ExperimentSideRail experiment={namedExperiment} />
      </TestLinkProvider>,
      { router: true },
    );

    expect(await screen.findByRole('heading', { name: 'Pipeline' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Run' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Scorers' })).toBeDefined();
    expect(await screen.findByText('Avg score')).toBeDefined();
    // 0.5, 1 and 1 average to 0.833 across the run.
    expect(await screen.findByText('0.833')).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });
});
