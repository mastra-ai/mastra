import type { DatasetExperiment } from '@mastra/client-js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import ExperimentsPage from '..';
import { buildDataset, buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import {
  buildListExperimentsResponse,
  emptyReviewSummary,
  experiments,
} from '@/domains/experiments/components/__tests__/fixtures/experiments';
import {
  noAgents,
  noProcessors,
  noScorers,
  noWorkflows,
} from '@/domains/experiments/components/__tests__/fixtures/target-registries';
import { EXPERIMENTS_PAGE_SIZE } from '@/domains/experiments/hooks/use-experiments-for-dataset-filter';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const datasetOne = buildDataset({ id: 'dataset-1', name: 'Dataset One' });
const datasetTwo = buildDataset({ id: 'dataset-2', name: 'Dataset Two' });

const experimentsAcrossDatasets: DatasetExperiment[] = [
  { ...experiments[0], datasetId: 'dataset-1' },
  { ...experiments[1], datasetId: 'dataset-2' },
];

interface HandlerOptions {
  /** What the global (paginated) list returns; defaults to every experiment. */
  globalList?: DatasetExperiment[];
}

function setupHandlers({ globalList = experimentsAcrossDatasets }: HandlerOptions = {}) {
  const calls = { global: 0, datasetPerPage: undefined as string | null | undefined };

  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments`, () => {
      calls.global += 1;
      return HttpResponse.json(buildListExperimentsResponse(globalList));
    }),
    http.get(`${TEST_BASE_URL}/api/datasets/:datasetId/experiments`, ({ params, request }) => {
      calls.datasetPerPage = new URL(request.url).searchParams.get('perPage');
      return HttpResponse.json(
        buildListExperimentsResponse(experimentsAcrossDatasets.filter(exp => exp.datasetId === params.datasetId)),
      );
    }),
    http.get(`${TEST_BASE_URL}/api/experiments/review-summary`, () => HttpResponse.json(emptyReviewSummary)),
    http.get(`${TEST_BASE_URL}/api/datasets`, () =>
      HttpResponse.json(buildListDatasetsResponse([datasetOne, datasetTwo])),
    ),
  );

  return calls;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(initialEntry: string) {
  return renderWithProviders(
    <TestLinkProvider>
      <ExperimentsPage />
      <LocationProbe />
    </TestLinkProvider>,
    { router: { initialEntries: [initialEntry] } },
  );
}

describe('Experiments page — dataset filter from URL', () => {
  it('only shows experiments of the dataset given in ?dataset=', async () => {
    setupHandlers();
    renderPage('/experiments?dataset=dataset-1');

    expect(await screen.findByText('entity-extraction / model-a')).toBeDefined();
    expect(screen.queryByText('entity-extraction / model-b')).toBeNull();
  });

  it('lists experiments of the dataset even when they are absent from the global list', async () => {
    setupHandlers({ globalList: [] });
    renderPage('/experiments?dataset=dataset-2');

    expect(await screen.findByText('entity-extraction / model-b')).toBeDefined();
  });

  it('requests a full page from the dataset-scoped endpoint instead of the global list', async () => {
    const calls = setupHandlers();
    renderPage('/experiments?dataset=dataset-1');

    await screen.findByText('entity-extraction / model-a');
    expect(calls.datasetPerPage).toBe(String(EXPERIMENTS_PAGE_SIZE));
    expect(calls.global).toBe(0);
  });

  it('keeps the filter toolbar when the dataset has no experiments', async () => {
    setupHandlers({ globalList: [] });
    renderPage('/experiments?dataset=dataset-without-runs');

    // The column header only renders once the (empty) list has loaded.
    expect(await screen.findByText('Target')).toBeDefined();
    expect(screen.getByRole('button', { name: /reset/i })).toBeDefined();
    expect(screen.queryByText('No Experiments yet')).toBeNull();
  });

  it('shows every experiment when the param is absent', async () => {
    setupHandlers();
    renderPage('/experiments');

    expect(await screen.findByText('entity-extraction / model-a')).toBeDefined();
    expect(screen.getByText('entity-extraction / model-b')).toBeDefined();
  });

  it('clears the ?dataset= param when filters are reset', async () => {
    setupHandlers();
    renderPage('/experiments?dataset=dataset-1');

    fireEvent.click(await screen.findByRole('button', { name: /reset/i }));

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/experiments'));
    expect(screen.getByText('entity-extraction / model-b')).toBeDefined();
  });
});
