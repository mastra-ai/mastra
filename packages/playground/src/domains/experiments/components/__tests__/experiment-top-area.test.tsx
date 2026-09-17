import { cleanup, fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperimentTopArea } from '../experiment-top-area';
import { experiments, noAgents, noProcessors, noWorkflows, noScorers } from './fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '@/test/render';

const namedExperiment = experiments[0];
const unnamedExperiment = experiments[2];

describe('ExperimentTopArea', () => {
  afterEach(cleanup);

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

  it('links to the review queue for this experiment next to Rerun', async () => {
    const { queryClient } = renderWithProviders(
      <TestLinkProvider>
        <ExperimentTopArea experiment={namedExperiment} />
      </TestLinkProvider>,
      { router: true },
    );

    const review = await screen.findByRole('link', { name: 'Review queue' });
    expect(review.getAttribute('href')).toBe(`/experiments/review-queue?experiment=${namedExperiment.id}`);
    const rerun = screen.getByRole('button', { name: /rerun/i });
    expect(review.parentElement).toBe(rerun.parentElement);

    await waitForMutationsIdle(queryClient);
  });

  it('does not repeat the experiment name or description in the page body', async () => {
    const { queryClient } = renderWithProviders(
      <TestLinkProvider>
        <ExperimentTopArea experiment={namedExperiment} />
      </TestLinkProvider>,
      { router: true },
    );

    expect(await screen.findByRole('link', { name: 'Review queue' })).toBeDefined();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByText(namedExperiment.description!)).toBeNull();

    await waitForMutationsIdle(queryClient);
  });

  it('opens the rename dialog from the actions menu', async () => {
    const { queryClient } = renderWithProviders(
      <TestLinkProvider>
        <ExperimentTopArea experiment={namedExperiment} />
      </TestLinkProvider>,
      { router: true },
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Experiment actions menu' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /rename experiment/i }));

    expect(await screen.findByRole('dialog', { name: /rename experiment/i })).toBeDefined();
    expect(screen.queryByRole('menuitem', { name: /delete experiment/i })).toBeNull();

    await waitForMutationsIdle(queryClient);
  });

  it('calls the delete handler from the actions menu', async () => {
    const onDeleteClick = vi.fn();
    const { queryClient } = renderWithProviders(
      <TestLinkProvider>
        <ExperimentTopArea experiment={namedExperiment} onDeleteClick={onDeleteClick} />
      </TestLinkProvider>,
      { router: true },
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Experiment actions menu' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /delete experiment/i }));
    expect(onDeleteClick).toHaveBeenCalledOnce();

    await waitForMutationsIdle(queryClient);
  });
});
