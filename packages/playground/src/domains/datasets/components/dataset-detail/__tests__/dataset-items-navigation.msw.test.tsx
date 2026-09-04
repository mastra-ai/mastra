import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { DATASET_ID, dataset, items } from './fixtures/dataset-items';
import DatasetPage from '@/pages/datasets/dataset';
import DatasetItemPage from '@/pages/datasets/dataset/item';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

const itemsResponse = {
  items,
  pagination: { total: items.length, page: 0, perPage: 10, hasMore: false },
};

/**
 * Renders the real dataset route tree (parent page + nested `items/:itemId`
 * child) inside a memory router, mirroring App.tsx.
 */
const renderDatasetRoute = (initialPath = `/datasets/${DATASET_ID}`) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const router = createMemoryRouter(
    [
      {
        path: '/datasets/:datasetId',
        element: <DatasetPage />,
        children: [{ path: 'items/:itemId', element: <DatasetItemPage /> }],
      },
    ],
    { initialEntries: [initialPath] },
  );

  render(
    <MastraReactProvider baseUrl={TEST_BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TestLinkProvider>
          <RouterProvider router={router} />
        </TestLinkProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  return { router };
};

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json({ datasets: [dataset] })),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () => HttpResponse.json(dataset)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/items`, () => HttpResponse.json(itemsResponse)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/versions`, () =>
      HttpResponse.json({ versions: [], pagination: { total: 0, page: 0, perPage: 10, hasMore: false } }),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments`, () => HttpResponse.json({ experiments: [] })),
  );
});

describe('dataset items navigation', () => {
  describe('when the user clicks an item in the dataset items list', () => {
    it('navigates to /datasets/{datasetId}/items/{itemId}', async () => {
      const { router } = renderDatasetRoute();

      fireEvent.click(await screen.findByText('item-a'));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/datasets/${DATASET_ID}/items/item-a`);
      });
    });

    it('opens the item detail panel as a dialog over the list', async () => {
      renderDatasetRoute();

      fireEvent.click(await screen.findByText('item-a'));

      const dialog = await screen.findByRole('dialog');
      expect(dialog.textContent).toContain('alpha');
      // list stays visible behind the panel
      expect(screen.getAllByText('item-b').length).toBeGreaterThan(0);
    });

    it('closes the panel when the open item is clicked again', async () => {
      const { router } = renderDatasetRoute();

      fireEvent.click(await screen.findByText('item-a'));
      await screen.findByRole('dialog');

      // 'item-a' also appears inside the open panel; the first match is the list row.
      fireEvent.click(screen.getAllByText('item-a')[0]);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/datasets/${DATASET_ID}`);
      });
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('when visiting the item URL directly', () => {
    it('renders the items list with the panel open', async () => {
      renderDatasetRoute(`/datasets/${DATASET_ID}/items/item-b`);

      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog.textContent).toContain('beta'));
      expect(screen.getAllByText('item-a').length).toBeGreaterThan(0);
    });

    it('shows a not-found state for an unknown item id', async () => {
      renderDatasetRoute(`/datasets/${DATASET_ID}/items/does-not-exist`);

      const dialog = await screen.findByRole('dialog');
      await waitFor(() => {
        expect(dialog.textContent).toContain('Item not found');
      });
    });
  });

  describe('keyboard navigation while an item is open (regardless of focus)', () => {
    it('navigates to the next item on PageDown and previous on PageUp from anywhere', async () => {
      const { router } = renderDatasetRoute(`/datasets/${DATASET_ID}/items/item-b`);

      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog.textContent).toContain('beta'));

      // Dispatched on the body: focus is NOT inside the panel.
      fireEvent.keyDown(document.body, { key: 'PageDown' });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/datasets/${DATASET_ID}/items/item-c`);
      });

      fireEvent.keyDown(document.body, { key: 'PageUp' });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/datasets/${DATASET_ID}/items/item-b`);
      });
    });

    it('closes the panel on Escape', async () => {
      const { router } = renderDatasetRoute(`/datasets/${DATASET_ID}/items/item-b`);

      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog.textContent).toContain('beta'));

      fireEvent.keyDown(document.body, { key: 'Escape' });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/datasets/${DATASET_ID}`);
      });
    });
  });
});
