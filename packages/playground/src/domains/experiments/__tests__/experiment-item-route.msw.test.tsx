import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  DATASET_ID,
  EXPERIMENT_ID,
  emptyScoresResponse,
  experiment,
  experimentsResponse,
  noAgents,
  noScorers,
  noWorkflows,
  resultsResponse,
} from './fixtures/experiment-item-route';
import ExperimentPage from '@/pages/experiments/experiment';
import ExperimentItemPage from '@/pages/experiments/experiment/item';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

/**
 * Renders the real experiment route tree (parent list page + nested
 * `items/:itemId` child) inside a memory router, mirroring App.tsx.
 */
const renderExperimentRoute = (initialPath = `/experiments/${EXPERIMENT_ID}`) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const router = createMemoryRouter(
    [
      {
        path: '/experiments/:experimentId',
        element: <ExperimentPage />,
        children: [{ path: 'items/:itemId', element: <ExperimentItemPage /> }],
      },
    ],
    { initialEntries: [initialPath] },
  );

  render(
    <MastraReactProvider baseUrl={TEST_BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  return { router, queryClient };
};

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json(experimentsResponse)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments`, () => HttpResponse.json(experimentsResponse)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}`, () =>
      HttpResponse.json(experiment),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results`, () =>
      HttpResponse.json(resultsResponse),
    ),
    http.get(`${TEST_BASE_URL}/api/scores/run/${EXPERIMENT_ID}`, () => HttpResponse.json(emptyScoresResponse)),
  );
});

const openResultsTab = async () => {
  fireEvent.click(await screen.findByRole('tab', { name: 'Results' }));
};

describe('experiment item sub-route', () => {
  describe('when the user clicks a dataset item in the results list', () => {
    it('navigates to /experiments/{experimentId}/items/{itemId}', async () => {
      const { router } = renderExperimentRoute();

      await openResultsTab();
      fireEvent.click(await screen.findByText('item-2'));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/experiments/${EXPERIMENT_ID}/items/item-2`);
      });
    });

    it('opens the item detail panel as a dialog', async () => {
      renderExperimentRoute();

      await openResultsTab();
      fireEvent.click(await screen.findByText('item-2'));

      const dialog = await screen.findByRole('dialog');
      expect(dialog.textContent).toContain('second question');
    });

    it('closes the panel when the open item is clicked again', async () => {
      const { router } = renderExperimentRoute();

      await openResultsTab();
      fireEvent.click(await screen.findByText('item-2'));
      await screen.findByRole('dialog');

      // 'item-2' also appears inside the open panel; the first match is the list row.
      fireEvent.click(screen.getAllByText('item-2')[0]);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/experiments/${EXPERIMENT_ID}`);
      });
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('when visiting the item URL directly', () => {
    it('renders the results list with the panel open', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-3`);

      const dialog = await screen.findByRole('dialog');
      expect(dialog.textContent).toContain('third question');
      // list stays visible behind the panel
      expect(await screen.findByText('item-1')).toBeDefined();
    });

    it('shows the Results tab as active without user interaction', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-3`);

      await screen.findByRole('dialog');
      const resultsTab = await screen.findByRole('tab', { name: 'Results' });
      await waitFor(() => {
        expect(resultsTab.getAttribute('aria-selected')).toBe('true');
      });
    });

    it('shows a not-found state for an unknown item id', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/does-not-exist`);

      const dialog = await screen.findByRole('dialog');
      await waitFor(() => {
        expect(dialog.textContent).toContain('Item not found');
      });
    });
  });

  describe('keyboard navigation while an item is open (regardless of focus)', () => {
    it('navigates to the next item on PageDown and previous on PageUp from anywhere', async () => {
      const { router } = renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-2`);

      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog.textContent).toContain('second question'));

      // Dispatched on the body: focus is NOT inside the panel.
      fireEvent.keyDown(document.body, { key: 'PageDown' });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/experiments/${EXPERIMENT_ID}/items/item-3`);
      });

      fireEvent.keyDown(document.body, { key: 'PageUp' });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/experiments/${EXPERIMENT_ID}/items/item-2`);
      });
    });

    it('stays on the last item when PageDown is pressed at the boundary', async () => {
      const { router } = renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-3`);

      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog.textContent).toContain('third question'));

      fireEvent.keyDown(document.body, { key: 'PageDown' });
      expect(router.state.location.pathname).toBe(`/experiments/${EXPERIMENT_ID}/items/item-3`);
    });

    it('closes the panel on Escape', async () => {
      const { router } = renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-2`);

      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog.textContent).toContain('second question'));

      fireEvent.keyDown(document.body, { key: 'Escape' });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/experiments/${EXPERIMENT_ID}`);
      });
    });

    it('ignores keys typed into an input field', async () => {
      const { router } = renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-2`);
      await screen.findByRole('dialog');

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      fireEvent.keyDown(input, { key: 'PageDown' });
      input.remove();

      expect(router.state.location.pathname).toBe(`/experiments/${EXPERIMENT_ID}/items/item-2`);
    });
  });

  describe('when the user opens a needs-review result in review', () => {
    it('closes the panel and shows the Reviews tab with the result featured via the URL', async () => {
      const { router } = renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-3`);

      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog.textContent).toContain('third question'));

      fireEvent.click(await screen.findByRole('button', { name: /review/i }));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/experiments/${EXPERIMENT_ID}`);
        expect(router.state.location.search).toBe('?review=res-3');
      });
      expect(screen.queryByRole('dialog')).toBeNull();

      const reviewsTab = await screen.findByRole('tab', { name: /reviews/i });
      await waitFor(() => {
        expect(reviewsTab.getAttribute('aria-selected')).toBe('true');
      });
    });
  });

  describe('when resizing the panel', () => {
    it('exposes the design-system resize separator on the panel edge', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-2`);

      await screen.findByRole('dialog');
      expect(await screen.findByRole('separator')).toBeDefined();
    });
  });
});
