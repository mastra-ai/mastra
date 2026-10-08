// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { ExperimentCrumb } from '../experiment-crumb';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const renderCrumb = (experimentId: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/experiments/${experimentId}`]}>
          <Routes>
            <Route path="/experiments/:experimentId" element={<ExperimentCrumb />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const stubExperiment = (experiment: { id: string; datasetId: string; name?: string }) => {
  server.use(
    http.get(`${BASE_URL}/api/experiments/:experimentId`, ({ params }) =>
      params.experimentId === experiment.id
        ? HttpResponse.json(experiment)
        : HttpResponse.json({ error: 'not found' }, { status: 404 }),
    ),
  );
};

afterEach(() => cleanup());

describe('ExperimentCrumb', () => {
  it('should render the experiment name when the experiment has one', async () => {
    // Given an experiment with a name
    stubExperiment({ id: 'exp-named-0001', datasetId: 'ds-1', name: 'Nightly regression' });

    // When the crumb renders for that experiment
    renderCrumb('exp-named-0001');

    // Then the name is shown instead of the id
    expect(await screen.findByText('Nightly regression')).toBeDefined();
    expect(screen.queryByText(/exp-name/)).toBeNull();
  });

  it('should render the name of an experiment that is not on the first page of the experiments list', async () => {
    // Given the experiments list's first page doesn't include the experiment
    server.use(
      http.get(`${BASE_URL}/api/experiments`, () =>
        HttpResponse.json({ experiments: [], pagination: { total: 11, page: 0, perPage: 10, hasMore: true } }),
      ),
    );
    stubExperiment({ id: 'exp-older-0001', datasetId: 'ds-1', name: 'Older run' });

    // When the crumb renders for that experiment
    renderCrumb('exp-older-0001');

    // Then the name is still shown
    expect(await screen.findByText('Older run')).toBeDefined();
  });

  it('should fall back to the short id when the experiment has no name', async () => {
    // Given an experiment without a name
    stubExperiment({ id: 'abcdef1234567890', datasetId: 'ds-1' });

    // When the crumb renders
    renderCrumb('abcdef1234567890');

    // Then the truncated id is shown
    expect(await screen.findByText('abcdef12...')).toBeDefined();
  });

  it('should show the short id while the experiment is still loading', () => {
    // Given the experiment has not resolved yet
    server.use(http.get(`${BASE_URL}/api/experiments/:experimentId`, () => new Promise(() => {})));

    // When the crumb renders
    renderCrumb('abcdef1234567890');

    // Then the id fallback is shown immediately (no empty crumb)
    expect(screen.getByText('abcdef12...')).toBeDefined();
  });
});
