import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import ExperimentsPage from '..';
import { buildDataset, buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import { experiments } from '@/domains/experiments/components/__tests__/fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const datasetOne = buildDataset({ id: 'dataset-1', name: 'Dataset One' });
const datasetTwo = buildDataset({ id: 'dataset-2', name: 'Dataset Two' });

const experimentsAcrossDatasets = [
  { ...experiments[0], datasetId: 'dataset-1' },
  { ...experiments[1], datasetId: 'dataset-2' },
];

function setupHandlers() {
  server.use(
    http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json({ experiments: experimentsAcrossDatasets })),
    http.get(`${TEST_BASE_URL}/api/experiments/review-summary`, () => HttpResponse.json({ experiments: [] })),
    http.get(`${TEST_BASE_URL}/api/datasets`, () =>
      HttpResponse.json(buildListDatasetsResponse([datasetOne, datasetTwo])),
    ),
  );
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
