import type { MastraClient } from '@mastra/client-js';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { DatasetItemsView } from '../dataset-items-view';
import { DATASET_ID, dataset, items } from './fixtures/dataset-items';
import { buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import { DatasetItemPanelProvider } from '@/domains/datasets/context/dataset-item-panel-context';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const itemsResponse: Awaited<ReturnType<MastraClient['listDatasetItems']>> = {
  items,
  pagination: { total: items.length, page: 0, perPage: 10, hasMore: false },
};

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse([dataset]))),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () => HttpResponse.json(dataset)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/items`, () => HttpResponse.json(itemsResponse)),
  );
});

function renderView() {
  return renderWithProviders(
    <TestLinkProvider>
      <DatasetItemPanelProvider datasetId={DATASET_ID} items={items} isLoadingItems={false}>
        <DatasetItemsView
          datasetId={DATASET_ID}
          leftSlot={<span>left slot</span>}
          rightSlot={<span>right slot</span>}
        />
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

  it('renders the left slot before the "Add Item" action, on the toolbar row', async () => {
    renderView();
    await screen.findByText('item-a');

    const toolbar = screen.getByTestId('dataset-items-toolbar');
    const left = within(toolbar).getByText('left slot');
    const addItem = within(toolbar).getByRole('button', { name: /add item/i });
    expect(left.compareDocumentPosition(addItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not own the "View experiments" action (it lives in the page header)', async () => {
    renderView();
    await screen.findByText('item-a');

    expect(screen.queryByRole('link', { name: /view experiments/i })).toBeNull();
  });
});
