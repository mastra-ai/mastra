import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { DatasetItemsView } from '../dataset-items-view';
import { DATASET_ID, dataset, items } from './fixtures/dataset-items';
import { DatasetItemPanelProvider } from '@/domains/datasets/context/dataset-item-panel-context';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const itemsResponse = {
  items,
  pagination: { total: items.length, page: 0, perPage: 10, hasMore: false },
};

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json({ datasets: [dataset] })),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () => HttpResponse.json(dataset)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/items`, () => HttpResponse.json(itemsResponse)),
  );
});

function renderView() {
  return renderWithProviders(
    <TestLinkProvider>
      <DatasetItemPanelProvider datasetId={DATASET_ID} items={items} isLoadingItems={false}>
        <DatasetItemsView datasetId={DATASET_ID} rightSlot={<span>right slot</span>} />
      </DatasetItemPanelProvider>
    </TestLinkProvider>,
    { router: { initialEntries: [`/datasets/${DATASET_ID}`] } },
  );
}

describe('DatasetItemsView', () => {
  it('renders the dataset items and the right slot', async () => {
    renderView();

    expect(await screen.findByText('item-a')).toBeDefined();
    expect(screen.getByText('right slot')).toBeDefined();
  });

  it('does not render Experiments or Review tabs', async () => {
    renderView();
    await screen.findByText('item-a');

    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText('Review')).toBeNull();
  });

  it('links to the global experiments page filtered by this dataset', async () => {
    renderView();

    const link = await screen.findByRole('link', { name: /view experiments/i });
    expect(link.getAttribute('href')).toBe(`/experiments?dataset=${DATASET_ID}`);
  });
});
