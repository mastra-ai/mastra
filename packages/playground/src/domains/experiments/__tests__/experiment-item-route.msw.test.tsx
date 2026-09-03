import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  DATASET_ID,
  EXPERIMENT_ID,
  emptyScoresResponse,
  experiment,
  experimentSpanDetailById,
  experimentResultScoresResponse,
  experimentSpanFeedback,
  experimentTraceFeedback,
  experimentTraceScores,
  experimentTraceSpans,
  experimentsResponse,
  noAgents,
  noProcessors,
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
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!;
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
});

afterAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
});

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
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json(experimentsResponse)),
    // The meta bar resolves the dataset name; a 404 falls back to the raw id.
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () =>
      HttpResponse.json({ error: 'not found' }, { status: 404 }),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments`, () => HttpResponse.json(experimentsResponse)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}`, () =>
      HttpResponse.json(experiment),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results`, () =>
      HttpResponse.json(resultsResponse),
    ),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/light`, () => HttpResponse.json(experimentTraceSpans)),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/spans/:spanId`, ({ params }) => {
      const detail = experimentSpanDetailById[String(params.spanId)];
      return detail ? HttpResponse.json(detail) : HttpResponse.json({ error: 'not found' }, { status: 404 });
    }),
    http.get(`${TEST_BASE_URL}/api/observability/feedback`, ({ request }) => {
      const spanId = new URL(request.url).searchParams.get('spanId');
      return HttpResponse.json(spanId ? experimentSpanFeedback : experimentTraceFeedback);
    }),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/:spanId/scores`, () =>
      HttpResponse.json(experimentTraceScores),
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

  describe('when the user selects results for review', () => {
    it('shows the selected count in the review action without a separate selection label', async () => {
      renderExperimentRoute();

      await openResultsTab();
      fireEvent.click(await screen.findByRole('checkbox', { name: 'Select result item-1' }));

      expect(await screen.findByRole('button', { name: 'Flag 1 to review' })).toBeDefined();
      expect(screen.queryByText('1 selected')).toBeNull();
    });

    it('only shows the selection actions once something is selected', async () => {
      renderExperimentRoute();

      await openResultsTab();
      // Selecting is what reveals the actions, so no bulk-selection affordance is needed beforehand.
      expect(await screen.findByRole('checkbox', { name: 'Select result item-1' })).toBeDefined();
      expect(screen.queryByRole('button', { name: /Flag \d+ to review/ })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
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

  describe('when the user opens a result trace and selects a span', () => {
    it('shows trace feedback and anchor-span evaluations with badge counts', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      await screen.findByRole('dialog');
      fireEvent.click(await screen.findByRole('button', { name: 'Trace' }));

      const evaluationsTab = await screen.findByRole('tab', { name: /evaluations \(1\)/i });
      const feedbackTab = screen.getByRole('tab', { name: /feedback \(1\)/i });

      fireEvent.click(evaluationsTab);
      expect((await screen.findAllByText('Experiment relevance')).length).toBeGreaterThan(0);

      fireEvent.click(feedbackTab);
      expect(await screen.findByText('Trace feedback for the experiment run')).toBeDefined();
    });

    it('opens the existing experiment score details for a matching trace score', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/scores/run/${EXPERIMENT_ID}`, () =>
          HttpResponse.json(experimentResultScoresResponse),
        ),
      );
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      await screen.findByRole('dialog');
      fireEvent.click(await screen.findByRole('button', { name: 'Trace' }));
      fireEvent.click(await screen.findByRole('tab', { name: /evaluations \(1\)/i }));
      fireEvent.click(await screen.findByRole('button', { name: /0\.9Experiment relevance/i }));

      expect(await screen.findByText('Matches the experiment result score')).toBeDefined();
    });

    it('keeps the trace evaluations open when a trace score has no experiment score match', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      await screen.findByRole('dialog');
      fireEvent.click(await screen.findByRole('button', { name: 'Trace' }));
      const evaluationsTab = await screen.findByRole('tab', { name: /evaluations \(1\)/i });
      fireEvent.click(evaluationsTab);
      fireEvent.click(await screen.findByRole('button', { name: /0\.9Experiment relevance/i }));

      expect(evaluationsTab.getAttribute('aria-selected')).toBe('true');
      expect(screen.queryByText('Matches the experiment result score')).toBeNull();
      expect(screen.getByRole('tab', { name: /evaluations \(1\)/i })).toBeDefined();
    });

    it('shows selected-span feedback and widens the route overlay', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(await screen.findByRole('button', { name: 'Trace' }));
      expect(dialog.parentElement?.className).toContain('grid-cols-[1fr_1fr]');

      fireEvent.click(await screen.findByText('Experiment tool call'));
      const spanHeading = await screen.findByText(/# experiment-span-child/);
      const spanSection = spanHeading.closest('section');
      if (!spanSection) throw new Error('Expected span detail section');

      expect(dialog.parentElement?.className).toContain('grid-cols-[1fr_4fr]');
      expect(spanSection.className).toContain('rounded-none');
      expect(spanSection.className).toContain('border-0');
      expect(spanSection.className).toContain('bg-transparent');

      fireEvent.click(await within(spanSection).findByRole('tab', { name: /feedback \(1\)/i }));
      expect(await screen.findByText('Child span feedback for the tool call')).toBeDefined();

      fireEvent.click(within(spanSection).getByLabelText('Close Panel'));
      await waitFor(() => expect(dialog.parentElement?.className).toContain('grid-cols-[1fr_1fr]'));
      expect(screen.getByText('Experiment agent run')).toBeDefined();
    });

    it('shows the span details inside the shared trace card', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(await screen.findByRole('button', { name: 'Trace' }));
      fireEvent.click(await screen.findByText('Experiment tool call'));

      expect(await screen.findByText(/# experiment-span-child/)).toBeDefined();
      const traceSection = screen.getByText('Experiment agent run').closest('section');
      const panelGrid = traceSection?.parentElement;
      const topLevelPanels = Array.from(panelGrid?.children ?? []).filter(child => child.tagName === 'SECTION');
      expect(topLevelPanels).toHaveLength(2);
      await waitFor(() => expect(screen.queryByText('Loading span details...')).toBeNull());
      expect(dialog.isConnected).toBe(true);
    });

    it('navigates between adjacent spans inside the shared trace card', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      await screen.findByRole('dialog');
      fireEvent.click(await screen.findByRole('button', { name: 'Trace' }));
      fireEvent.click(await screen.findByText('Experiment tool call'));
      expect(await screen.findByText(/# experiment-span-child/)).toBeDefined();

      fireEvent.click(screen.getByLabelText('Previous span'));
      expect(await screen.findByText(/# experiment-span-root/)).toBeDefined();

      fireEvent.click(screen.getByLabelText('Next span'));
      expect(await screen.findByText(/# experiment-span-child/)).toBeDefined();
    });

    it('closes span details without closing the trace card', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(await screen.findByRole('button', { name: 'Trace' }));
      fireEvent.click(await screen.findByText('Experiment tool call'));
      expect(await screen.findByText(/# experiment-span-child/)).toBeDefined();

      const spanSection = screen.getByText(/# experiment-span-child/).closest('section');
      if (!spanSection) throw new Error('Expected span detail section');
      fireEvent.click(within(spanSection).getByLabelText('Close Panel'));

      await waitFor(() => expect(screen.queryByText(/# experiment-span-child/)).toBeNull());
      expect(screen.getByText('Experiment agent run')).toBeDefined();
      expect(dialog.isConnected).toBe(true);
    });

    it('closes the trace card without closing the result dialog', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(await screen.findByRole('button', { name: 'Trace' }));
      expect(await screen.findByText('Experiment agent run')).toBeDefined();

      const traceSection = screen.getByText('Experiment agent run').closest('section');
      if (!traceSection) throw new Error('Expected trace section');
      fireEvent.click(within(traceSection).getByLabelText('Close Panel'));

      await waitFor(() => expect(screen.queryByText('Experiment agent run')).toBeNull());
      expect(dialog.isConnected).toBe(true);
      expect(dialog.textContent).toContain('first question');
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
      const reviewDialog = await screen.findByRole('dialog', { name: 'Review item res-3' });
      expect(reviewDialog.textContent).toContain('third question');

      const reviewsTab = await screen.findByRole('tab', { name: /reviews/i });
      await waitFor(() => {
        expect(reviewsTab.getAttribute('aria-selected')).toBe('true');
      });
    });
  });
});
