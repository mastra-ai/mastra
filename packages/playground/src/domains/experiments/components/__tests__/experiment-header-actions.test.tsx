import { cleanup, fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperimentHeaderActions } from '../experiment-header-actions';
import { experiments, noAgents, noProcessors, noWorkflows, noScorers } from './fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '@/test/render';

const namedExperiment = experiments[0];

const renderActions = (onDeleteClick?: () => void) =>
  renderWithProviders(
    <TestLinkProvider>
      <ExperimentHeaderActions experiment={namedExperiment} onDeleteClick={onDeleteClick} />
    </TestLinkProvider>,
    { router: true },
  );

describe('ExperimentHeaderActions', () => {
  afterEach(cleanup);

  beforeEach(() => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
      http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
      http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
      http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
      http.get(`${TEST_BASE_URL}/api/scores/run/:experimentId`, () =>
        HttpResponse.json({ scores: [], pagination: { total: 0, page: 0, perPage: 100, hasMore: false } }),
      ),
    );
  });

  it('renders Rerun and the actions menu, with no review queue link', async () => {
    const { queryClient } = renderActions();

    expect(await screen.findByRole('button', { name: /rerun/i })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Experiment actions menu' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Review queue' })).toBeNull();

    await waitForMutationsIdle(queryClient);
  });

  it('opens the rename dialog from the actions menu', async () => {
    const { queryClient } = renderActions();

    fireEvent.click(await screen.findByRole('button', { name: 'Experiment actions menu' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /rename experiment/i }));

    expect(await screen.findByRole('dialog', { name: /rename experiment/i })).toBeDefined();
    expect(screen.queryByRole('menuitem', { name: /delete experiment/i })).toBeNull();

    await waitForMutationsIdle(queryClient);
  });

  it('calls the delete handler from the actions menu', async () => {
    const onDeleteClick = vi.fn();
    const { queryClient } = renderActions(onDeleteClick);

    fireEvent.click(await screen.findByRole('button', { name: 'Experiment actions menu' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /delete experiment/i }));
    expect(onDeleteClick).toHaveBeenCalledOnce();

    await waitForMutationsIdle(queryClient);
  });
});
