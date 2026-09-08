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

const stubExperiments = (experiments: Array<{ id: string; datasetId: string; name?: string }>) => {
  server.use(
    http.get(`${BASE_URL}/api/experiments`, () =>
      HttpResponse.json({ experiments, pagination: { total: experiments.length, page: 0 } }),
    ),
  );
};

afterEach(() => cleanup());

describe('ExperimentCrumb', () => {
  it('should render the experiment name when the experiment has one', async () => {
    // Given an experiment with a name
    stubExperiments([{ id: 'exp-named-0001', datasetId: 'ds-1', name: 'Nightly regression' }]);

    // When the crumb renders for that experiment
    renderCrumb('exp-named-0001');

    // Then the name is shown instead of the id
    expect(await screen.findByText('Nightly regression')).toBeDefined();
    expect(screen.queryByText(/exp-name/)).toBeNull();
  });

  it('should fall back to the short id when the experiment has no name', async () => {
    // Given an experiment without a name
    stubExperiments([{ id: 'abcdef1234567890', datasetId: 'ds-1' }]);

    // When the crumb renders
    renderCrumb('abcdef1234567890');

    // Then the truncated id is shown
    expect(await screen.findByText('abcdef12...')).toBeDefined();
  });

  it('should show the short id while the experiment is still loading', () => {
    // Given the experiments list has not resolved yet
    server.use(http.get(`${BASE_URL}/api/experiments`, () => new Promise(() => {})));

    // When the crumb renders
    renderCrumb('abcdef1234567890');

    // Then the id fallback is shown immediately (no empty crumb)
    expect(screen.getByText('abcdef12...')).toBeDefined();
  });
});
