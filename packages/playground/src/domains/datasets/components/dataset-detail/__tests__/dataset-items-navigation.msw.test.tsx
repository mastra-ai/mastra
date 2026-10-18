import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DATASET_ID, dataset, items } from './fixtures/dataset-items';
import { StudioFrame } from '@/components/layout';
import { RouteSidePanelProvider } from '@/lib/route-side-panel';
import DatasetPage from '@/pages/datasets/dataset';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

const itemsResponse = {
  items,
  pagination: { total: items.length, page: 0, perPage: 10, hasMore: false },
};

const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!;
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
});

afterAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
});

/**
 * Renders the real dataset route tree (parent page + nested `items/:itemId`
 * child) inside a memory router and the Studio frame with its route side panel,
 * mirroring App.tsx and the app layout.
 */
const renderDatasetRoute = (initialPath = `/datasets/${DATASET_ID}`) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const router = createMemoryRouter(
    [
      {
        element: (
          <RouteSidePanelProvider>
            <StudioFrame>
              <Outlet />
            </StudioFrame>
          </RouteSidePanelProvider>
        ),
        children: [
          {
            path: '/datasets/:datasetId',
            element: <DatasetPage />,
            children: [{ path: 'items/:itemId', element: null }],
          },
        ],
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

const findItemPanel = (itemId: string) => screen.findByRole('region', { name: `Dataset item ${itemId}` });

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json({ datasets: [dataset] })),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () => HttpResponse.json(dataset)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/items`, () => HttpResponse.json(itemsResponse)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/items/:itemId`, ({ params }) => {
      const item = items.find(item => item.id === params.itemId);
      return item ? HttpResponse.json(item) : HttpResponse.json({ error: 'Item not found' }, { status: 404 });
    }),
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

    it('opens the item detail panel inline in the route side panel, beside the list', async () => {
      renderDatasetRoute();

      fireEvent.click(await screen.findByText('item-a'));

      const panel = await findItemPanel('item-a');
      await waitFor(() => expect(panel.textContent).toContain('alpha'));
      expect(screen.getByTestId('route-side-panel').contains(panel)).toBe(true);
      expect(screen.getByTestId('studio-frame').contains(panel)).toBe(false);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(within(screen.getByTestId('studio-frame')).getAllByText('item-b').length).toBeGreaterThan(0);
    });

    it('keeps the item out of the breadcrumb', async () => {
      renderDatasetRoute();

      fireEvent.click(await screen.findByText('item-a'));
      await findItemPanel('item-a');

      const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
      expect(within(breadcrumb).queryByText('Items')).toBeNull();
      expect(within(breadcrumb).queryByText('item-a')).toBeNull();
    });

    it('closes the panel when the open item is clicked again', async () => {
      const { router } = renderDatasetRoute();

      fireEvent.click(await screen.findByText('item-a'));
      await findItemPanel('item-a');

      // The id also appears in the open panel; target the list row.
      fireEvent.click(screen.getAllByText('item-a').find(el => !el.closest('[data-slot="data-panel"]'))!);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/datasets/${DATASET_ID}`);
      });
      await waitFor(() => expect(screen.queryByRole('region', { name: 'Dataset item item-a' })).toBeNull());
    });
  });

  describe('when visiting the item URL directly', () => {
    it('renders the items list with the panel open', async () => {
      renderDatasetRoute(`/datasets/${DATASET_ID}/items/item-b`);

      const panel = await findItemPanel('item-b');
      await waitFor(() => expect(panel.textContent).toContain('beta'));
      expect(screen.getAllByText('item-a').length).toBeGreaterThan(0);
    });

    it('shows a not-found state for an unknown item id', async () => {
      renderDatasetRoute(`/datasets/${DATASET_ID}/items/does-not-exist`);

      const panel = await findItemPanel('does-not-exist');
      await waitFor(() => {
        expect(panel.textContent).toContain('No loaded item "does-not-exist"');
      });
    });
  });

  describe('keyboard navigation while an item is open (regardless of focus)', () => {
    it('navigates to the next item on PageDown and previous on PageUp from anywhere', async () => {
      const { router } = renderDatasetRoute(`/datasets/${DATASET_ID}/items/item-b`);

      const panel = await findItemPanel('item-b');
      await waitFor(() => expect(panel.textContent).toContain('beta'));

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

      const panel = await findItemPanel('item-b');
      await waitFor(() => expect(panel.textContent).toContain('beta'));

      fireEvent.keyDown(document.body, { key: 'Escape' });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/datasets/${DATASET_ID}`);
      });
    });
  });
});
