import { screen, within } from '@testing-library/react';
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

  it('shows the Items count next to the search field', async () => {
    renderView();
    await screen.findByText('item-a');

    const search = screen.getByRole('textbox', { name: /search/i });
    const toolbar = search.closest('[data-testid="dataset-items-toolbar"]');
    expect(toolbar).not.toBeNull();
    expect(within(toolbar as HTMLElement).getByText('Items')).toBeDefined();
    expect(within(toolbar as HTMLElement).getByText(String(items.length))).toBeDefined();
  });

  it('does not own the "View experiments" action (it lives in the page header)', async () => {
    renderView();
    await screen.findByText('item-a');

    expect(screen.queryByRole('link', { name: /view experiments/i })).toBeNull();
  });
});
