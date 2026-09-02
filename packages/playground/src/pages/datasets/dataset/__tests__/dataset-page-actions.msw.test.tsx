import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { DatasetPage } from '../index';
import { buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import {
  DATASET_ID,
  dataset,
  items,
} from '@/domains/datasets/components/dataset-detail/__tests__/fixtures/dataset-items';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const itemsResponse = {
  items,
  pagination: { total: items.length, page: 0, perPage: 10, hasMore: false },
};

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse([dataset]))),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () => HttpResponse.json(dataset)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/items`, () => HttpResponse.json(itemsResponse)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/versions`, () =>
      HttpResponse.json({ versions: [], pagination: { total: 0, page: 0, perPage: 10, hasMore: false } }),
    ),
  );
});

function renderPage() {
  return renderWithProviders(
    <TestLinkProvider>
      <Routes>
        <Route path="/datasets/:datasetId" element={<DatasetPage />} />
      </Routes>
    </TestLinkProvider>,
    { router: { initialEntries: [`/datasets/${DATASET_ID}`] } },
  );
}

describe('DatasetPage actions', () => {
  it('places "View experiments" next to "Run Experiment" in the header actions', async () => {
    renderPage();

    const runButton = await screen.findByRole('button', { name: /run experiment/i });
    const link = within(runButton.parentElement as HTMLElement).getByRole('link', { name: /view experiments/i });

    expect(link.getAttribute('href')).toBe(`/experiments?dataset=${DATASET_ID}`);
    // Order: View experiments → version selector → Run Experiment.
    expect(link.compareDocumentPosition(runButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
