import type { MastraClient } from '@mastra/client-js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
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

let itemsRequests: URL[] = [];

beforeEach(() => {
  itemsRequests = [];
  server.use(
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse([dataset]))),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () => HttpResponse.json(dataset)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/items`, ({ request }) => {
      itemsRequests.push(new URL(request.url));
      return HttpResponse.json(itemsResponse);
    }),
  );
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderView(initialEntry = `/datasets/${DATASET_ID}`) {
  return renderWithProviders(
    <TestLinkProvider>
      <LocationProbe />
      <DatasetItemPanelProvider datasetId={DATASET_ID} items={items} isLoadingItems={false}>
        <DatasetItemsView datasetId={DATASET_ID} toolbarActionsSlot={<span>toolbar actions slot</span>} />
      </DatasetItemPanelProvider>
    </TestLinkProvider>,
    { router: { initialEntries: [initialEntry] } },
  );
}

describe('DatasetItemsView', () => {
  describe('when items are sorted from the Created column', () => {
    it('does not ask the server for a sort by default', async () => {
      renderView();
      await screen.findByText('item-a');

      expect(itemsRequests[0].searchParams.get('orderBy[field]')).toBeNull();
      expect(screen.getByRole('button', { name: 'Created, not sorted, sort ascending' })).not.toBeNull();
    });

    it('asks the server for oldest-first and writes it to the URL', async () => {
      renderView();
      await screen.findByText('item-a');

      fireEvent.click(screen.getByRole('button', { name: 'Created, not sorted, sort ascending' }));

      await waitFor(() => expect(itemsRequests.at(-1)?.searchParams.get('orderBy[field]')).toBe('createdAt'));
      expect(itemsRequests.at(-1)?.searchParams.get('orderBy[direction]')).toBe('ASC');
      expect(screen.getByTestId('location').textContent).toBe(`/datasets/${DATASET_ID}?sort=createdAt&dir=asc`);
    });

    it('restores the sort from the URL', async () => {
      renderView(`/datasets/${DATASET_ID}?sort=createdAt&dir=desc`);
      await screen.findByText('item-a');

      expect(itemsRequests[0].searchParams.get('orderBy[field]')).toBe('createdAt');
      expect(itemsRequests[0].searchParams.get('orderBy[direction]')).toBe('DESC');
      expect(screen.getByRole('button', { name: 'Created, sorted descending, sort ascending' })).not.toBeNull();
    });
  });

  it('renders the dataset items', async () => {
    renderView();

    expect(await screen.findByText('item-a')).toBeDefined();
  });

  it('does not render Experiments or Review tabs', async () => {
    renderView();
    await screen.findByText('item-a');

    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText('Review')).toBeNull();
  });

  it('renders the toolbar actions slot inside the toolbar, right before the "New item" action', async () => {
    renderView();
    await screen.findByText('item-a');

    const toolbar = screen.getByTestId('dataset-items-toolbar');
    const slot = screen.getByText('toolbar actions slot');
    const newItem = screen.getByRole('button', { name: 'New item' });
    expect(toolbar.contains(slot)).toBe(true);
    expect(slot.compareDocumentPosition(newItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not own the "Experiments" action (it lives in the page header)', async () => {
    renderView();
    await screen.findByText('item-a');

    expect(screen.queryByRole('link', { name: 'Experiments' })).toBeNull();
  });
});
