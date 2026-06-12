// @vitest-environment jsdom
import type { CompareExperimentsResponse, DatasetExperiment } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatasetExperimentsComparison } from '../dataset-experiments-comparison';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

// Layout-heavy children with their own concerns — the unit under test here is
// the comparison shell and its warnings notice.
vi.mock('../comparison-items-list', () => ({
  ComparisonItemsList: () => <div data-testid="comparison-items-list" />,
}));
vi.mock('../comparison-item-panel', () => ({
  ComparisonItemPanel: () => <div data-testid="comparison-item-panel" />,
}));
vi.mock('../experiment-in-comparison-info', () => ({
  ExperimentInComparisonInfo: () => <div data-testid="experiment-info" />,
}));

const experiment = (id: string): DatasetExperiment => ({
  id,
  name: id,
  datasetId: 'dataset-1',
  datasetVersion: 1,
  targetType: 'agent',
  targetId: 'support-agent',
  status: 'completed',
  totalItems: 1,
  succeededCount: 1,
  failedCount: 0,
  skippedCount: 0,
  startedAt: '2026-06-01T10:00:00.000Z',
  completedAt: '2026-06-01T10:05:00.000Z',
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-01T10:05:00.000Z',
});

const comparisonResponse = (warnings: string[]): CompareExperimentsResponse => ({
  baselineId: 'exp-a',
  items: [
    {
      itemId: 'item-1',
      input: { q: 'hi' },
      groundTruth: null,
      results: {
        'exp-a': { output: 'a', scores: { accuracy: 1 } },
        'exp-b': { output: 'b', scores: { accuracy: 0.5 } },
      },
    },
  ],
  warnings,
});

const renderComparison = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DatasetExperimentsComparison datasetId="dataset-1" experimentIdA="exp-a" experimentIdB="exp-b" />
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const useHandlers = (warnings: string[]) => {
  server.use(
    http.post(`${BASE_URL}/api/datasets/dataset-1/compare`, () => HttpResponse.json(comparisonResponse(warnings))),
    http.get(`${BASE_URL}/api/datasets/dataset-1/experiments/exp-a`, () => HttpResponse.json(experiment('exp-a'))),
    http.get(`${BASE_URL}/api/datasets/dataset-1/experiments/exp-b`, () => HttpResponse.json(experiment('exp-b'))),
  );
};

afterEach(() => cleanup());

describe('DatasetExperimentsComparison warnings', () => {
  it('renders comparability warnings from the compare API', async () => {
    useHandlers([
      'Experiment exp-b ran with tool replay/mocks while the other ran live — tool observations differ in kind, compare scores with care.',
    ]);

    renderComparison();

    expect(await screen.findByText('Compare with care')).toBeDefined();
    expect(screen.getByText(/ran with tool replay\/mocks while the other ran live/)).toBeDefined();
  });

  it('renders no warning notice for a clean comparison', async () => {
    useHandlers([]);

    renderComparison();

    expect(await screen.findByTestId('comparison-items-list')).toBeDefined();
    expect(screen.queryByText('Compare with care')).toBeNull();
  });
});
