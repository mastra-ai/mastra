import type { GetMetricAggregateArgs, GetMetricAggregateResponse, MastraClient } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
  experimentTraceSpansWithMetadata,
  experimentsResponse,
  noAgents,
  noProcessors,
  noScorers,
  noWorkflows,
  resultsResponse,
} from './fixtures/experiment-item-route';
import { StudioFrame } from '@/components/layout';
import { experimentTotalsBreakdown } from '@/domains/experiments/components/__tests__/fixtures/experiment-usage';
import { RouteSidePanelProvider } from '@/lib/route-side-panel';
import ExperimentPage from '@/pages/experiments/experiment';
import ReviewQueuePage from '@/pages/experiments/review-queue';
import { legacyTraceCapabilities, traceQueryCapabilities } from '@/pages/traces/__tests__/fixtures/trace-query';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';
import { pickTraceSideView, traceSideViewLabel } from '@/test/trace-side-view';

/**
 * Renders the real experiment route tree (parent list page + nested
 * `items/:itemId` child) inside a memory router and the Studio frame with its
 * route side panel, mirroring App.tsx and the app layout.
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
        element: (
          <RouteSidePanelProvider>
            <StudioFrame>
              <Outlet />
            </StudioFrame>
          </RouteSidePanelProvider>
        ),
        children: [
          {
            path: '/experiments/:experimentId',
            element: <ExperimentPage />,
            children: [{ path: 'items/:itemId', element: null }],
          },
          { path: '/experiments/review-queue', element: <ReviewQueuePage /> },
        ],
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

/**
 * The route's inline result panel (in the route side panel) is named `Experiment item <itemId>`
 * throughout; it shows a loading body until the result is in the list. Wait for the result body
 * so assertions target it.
 */
const findResultPanel = async (resultId: string) => {
  const panel = await screen.findByRole('region', { name: `Experiment item ${resultId.replace('res-', 'item-')}` });
  await within(panel).findByText('Item Id');
  return panel;
};

let metricRequests: GetMetricAggregateArgs[] = [];
let breakdownRequests: Parameters<MastraClient['getMetricBreakdown']>[0][] = [];

const metricAggregateByAggregation: Record<string, GetMetricAggregateResponse> = {
  sum: { value: 12400, estimatedCost: 0.0123, costUnit: 'USD' },
  avg: { value: 1850 },
  count: { value: 42 },
};

beforeEach(() => {
  metricRequests = [];
  breakdownRequests = [];
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(traceQueryCapabilities)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, async ({ request }) => {
      breakdownRequests.push((await request.json()) as Parameters<MastraClient['getMetricBreakdown']>[0]);
      return HttpResponse.json(experimentTotalsBreakdown);
    }),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/aggregate`, async ({ request }) => {
      const body = (await request.json()) as GetMetricAggregateArgs;
      metricRequests.push(body);
      return HttpResponse.json(metricAggregateByAggregation[body.aggregation] ?? { value: null });
    }),
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
    http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/experiments/${EXPERIMENT_ID}`, () => HttpResponse.json(experiment)),
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

describe('experiment item sub-route', () => {
  describe('when the experiment page renders', () => {
    it('shows results directly with no tabs', async () => {
      renderExperimentRoute();

      await screen.findByText('item-2');
      expect(screen.queryByRole('tab')).toBeNull();
    });
  });

  describe('given the experiment route on a metrics-capable store', () => {
    it('when the page loads, then it requests metrics filtered by the route experimentId and renders cost, tokens and avg duration', async () => {
      renderExperimentRoute();

      expect(await screen.findByText('Total tokens')).toBeDefined();
      expect(await screen.findByText('12,400')).toBeDefined();
      expect(await screen.findByText('$0.012')).toBeDefined();
      expect(await screen.findByText('1.85s avg per item')).toBeDefined();

      expect(metricRequests.length).toBeGreaterThanOrEqual(3);
      for (const body of [...metricRequests, ...breakdownRequests]) {
        expect(body.filters).toEqual({ experimentId: EXPERIMENT_ID });
      }
      expect(breakdownRequests.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('when the user clicks a dataset item in the results list', () => {
    it('navigates to /experiments/{experimentId}/items/{itemId}', async () => {
      const { router } = renderExperimentRoute();

      fireEvent.click(await screen.findByText('item-2'));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/experiments/${EXPERIMENT_ID}/items/item-2`);
      });
    });

    it('opens the item detail panel inline in the route side panel', async () => {
      renderExperimentRoute();

      fireEvent.click(await screen.findByText('item-2'));

      const panel = await findResultPanel('res-2');
      expect(panel.textContent).toContain('second question');
      expect(screen.getByTestId('route-side-panel').contains(panel)).toBe(true);
      expect(screen.getByTestId('studio-frame').contains(panel)).toBe(false);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes the panel when the open item is clicked again', async () => {
      const { router } = renderExperimentRoute();

      fireEvent.click(await screen.findByText('item-2'));
      await findResultPanel('res-2');

      // The id also appears in the breadcrumb, the sr-only page heading and the open panel; target the list row.
      fireEvent.click(screen.getAllByText('item-2').find(el => !el.closest('nav, h1, [data-slot="data-panel"]'))!);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/experiments/${EXPERIMENT_ID}`);
      });
      await waitFor(() => expect(screen.queryByRole('region', { name: 'Experiment item item-2' })).toBeNull());
    });
  });

  describe('when the user selects results for review', () => {
    it('shows the selected count and reveals the actions once something is selected', async () => {
      renderExperimentRoute();

      expect((await screen.findByRole('button', { name: '0 selected' })).hasAttribute('disabled')).toBe(true);
      expect(screen.queryByRole('button', { name: 'Request review' })).toBeNull();

      fireEvent.click(await screen.findByRole('checkbox', { name: 'Select result item-1' }));

      expect(await screen.findByRole('button', { name: '1 selected' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Request review' })).toBeDefined();
    });

    it('clears the selection and hides the actions when the count button is clicked', async () => {
      renderExperimentRoute();

      fireEvent.click(await screen.findByRole('checkbox', { name: 'Select result item-1' }));
      fireEvent.click(await screen.findByRole('button', { name: '1 selected' }));

      expect(await screen.findByRole('button', { name: '0 selected' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Request review' })).toBeNull();
    });
  });

  describe('when the user toggles the select-all checkbox', () => {
    const resultCheckboxes = () =>
      resultsResponse.results.map(r => screen.getByRole('checkbox', { name: `Select result ${r.itemId}` }));

    it('selects every loaded result', async () => {
      renderExperimentRoute();

      fireEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }));

      expect(await screen.findByRole('button', { name: `${resultsResponse.results.length} selected` })).toBeDefined();
      expect(resultCheckboxes().every(box => box.getAttribute('aria-checked') === 'true')).toBe(true);
    });

    it('shows a mixed state while only some results are selected', async () => {
      renderExperimentRoute();

      fireEvent.click(await screen.findByRole('checkbox', { name: 'Select result item-1' }));

      expect(screen.getByRole('checkbox', { name: 'Select all' }).getAttribute('aria-checked')).toBe('mixed');
    });

    it('clears the selection once every result is selected', async () => {
      renderExperimentRoute();

      const selectAll = await screen.findByRole('checkbox', { name: 'Select all' });
      fireEvent.click(selectAll);
      fireEvent.click(selectAll);

      expect(await screen.findByRole('button', { name: '0 selected' })).toBeDefined();
      expect(resultCheckboxes().every(box => box.getAttribute('aria-checked') === 'false')).toBe(true);
    });
  });

  describe('when the user selects results to tag', () => {
    const patches: Array<{ resultId: string; body: unknown }> = [];

    beforeEach(() => {
      patches.length = 0;
      server.use(
        http.patch(
          `${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results/:resultId`,
          async ({ params, request }) => {
            const body = await request.json();
            patches.push({ resultId: String(params.resultId), body });
            const original = resultsResponse.results.find(r => r.id === params.resultId)!;
            return HttpResponse.json({ ...original, ...(body as object) });
          },
        ),
      );
    });

    async function openTagPicker() {
      const trigger = await screen.findByRole('combobox');
      expect(trigger.textContent).toContain('Add tag');
      fireEvent.click(trigger);
      return screen.findByPlaceholderText('Search or create tag...');
    }

    function selectOption(option: HTMLElement) {
      fireEvent.pointerDown(option, { pointerType: 'mouse' });
      fireEvent.click(option, { detail: 1 });
    }

    it('only shows the "Add tag" picker once something is selected', async () => {
      renderExperimentRoute();

      await screen.findByRole('checkbox', { name: 'Select result item-1' });
      expect(screen.queryByRole('combobox')).toBeNull();

      fireEvent.click(screen.getByRole('checkbox', { name: 'Select result item-1' }));

      expect((await screen.findByRole('combobox')).textContent).toContain('Add tag');
    });

    it('lists tags already present on results as existing options', async () => {
      renderExperimentRoute();

      fireEvent.click(await screen.findByRole('checkbox', { name: 'Select result item-1' }));
      await openTagPicker();

      expect(await screen.findByRole('option', { name: 'alpha' })).toBeDefined();
    });

    it('creates a new tag on every selected result and keeps the selection', async () => {
      renderExperimentRoute();

      fireEvent.click(await screen.findByRole('checkbox', { name: 'Select result item-1' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select result item-2' }));

      const search = await openTagPicker();
      fireEvent.input(search, { target: { value: 'smoke' }, inputType: 'insertText' });
      selectOption(await screen.findByRole('option', { name: 'Create "smoke"' }));

      await waitFor(() => {
        expect(patches).toEqual([
          { resultId: 'res-1', body: { tags: ['smoke'] } },
          { resultId: 'res-2', body: { tags: ['alpha', 'smoke'] } },
        ]);
      });
      expect(screen.getByRole('checkbox', { name: 'Select result item-1' }).getAttribute('aria-checked')).toBe('true');
      expect(screen.getByRole('checkbox', { name: 'Select result item-2' }).getAttribute('aria-checked')).toBe('true');
    });
  });

  describe('when a tagged result is open in the panel', () => {
    it('does not offer to edit its tags', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-2`);
      const dialog = await findResultPanel('res-2');

      expect(within(dialog).queryByRole('button', { name: 'Remove tag alpha' })).toBeNull();
      expect(within(dialog).queryByRole('combobox')).toBeNull();
    });
  });

  describe('when visiting the item URL directly', () => {
    it('renders the results list with the panel open', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-3`);

      const dialog = await findResultPanel('res-3');
      expect(dialog.textContent).toContain('third question');
      // list stays visible behind the panel
      expect(await screen.findByText('item-1')).toBeDefined();
    });

    it('shows a not-found state for an unknown item id', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/does-not-exist`);

      const dialog = await screen.findByRole('region', { name: 'Experiment item does-not-exist' });
      await waitFor(() => {
        expect(dialog.textContent).toContain('No loaded result for item "does-not-exist"');
      });
    });
  });

  describe('result panel Feedback tab', () => {
    it('shows the trace feedback count as soon as the panel opens', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      const dialog = await findResultPanel('res-1');
      expect(await within(dialog).findByRole('tab', { name: /^feedback \(1\)/i })).toBeDefined();
    });

    describe('when the server does not support trace query', () => {
      it('shows no Feedback tab and never requests feedback', async () => {
        const onFeedback = vi.fn();
        const onCapabilities = vi.fn();
        server.use(
          http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => {
            onCapabilities();
            return HttpResponse.json(legacyTraceCapabilities);
          }),
          http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => {
            onFeedback();
            return HttpResponse.json(experimentTraceFeedback);
          }),
        );
        renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

        const dialog = await findResultPanel('res-1');
        await waitFor(() => expect(onCapabilities).toHaveBeenCalled());
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(within(dialog).queryByRole('tab', { name: /feedback/i })).toBeNull();
        expect(onFeedback).not.toHaveBeenCalled();
      });
    });
  });

  // Three stacked drawers per test; under full-suite load these exceed the default 5s.
  describe('when the user opens a result trace and selects a span', { timeout: 15_000 }, () => {
    it('shows trace feedback and anchor-span scores with their counts', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      await findResultPanel('res-1');
      fireEvent.click(await screen.findByRole('button', { name: 'See trace' }));

      const traceDialog = await screen.findByRole('dialog', { name: 'Trace experiment-trace-1' });
      const sideColumn = traceDialog.querySelector('[data-trace-side-column]') as HTMLElement;
      expect(await within(sideColumn).findByRole('tab', { name: /^feedback \(1\)/i })).toBeDefined();
      expect(await within(sideColumn).findByRole('tab', { name: /scores \(1\)/i })).toBeDefined();

      await pickTraceSideView(/^scores/i, traceDialog);
      expect(await within(sideColumn).findByText('Experiment relevance')).toBeDefined();

      await pickTraceSideView(/^feedback/i, traceDialog);
      expect(await within(sideColumn).findByText('Trace feedback for the experiment run')).toBeDefined();
    });

    it('opens the existing experiment score details for a matching trace score', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/scores/run/${EXPERIMENT_ID}`, () =>
          HttpResponse.json(experimentResultScoresResponse),
        ),
      );
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      await findResultPanel('res-1');
      fireEvent.click(await screen.findByRole('button', { name: 'See trace' }));
      const traceDialog = await screen.findByRole('dialog', { name: 'Trace experiment-trace-1' });
      await pickTraceSideView(/^scores/i, traceDialog);
      fireEvent.click(await within(traceDialog).findByRole('button', { name: 'Open Experiment relevance score' }));

      expect(await screen.findByText('Matches the experiment result score')).toBeDefined();
    });

    it('keeps the trace scores open when a trace score has no experiment score match', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      await findResultPanel('res-1');
      fireEvent.click(await screen.findByRole('button', { name: 'See trace' }));
      const traceDialog = await screen.findByRole('dialog', { name: 'Trace experiment-trace-1' });
      await pickTraceSideView(/^scores/i, traceDialog);
      fireEvent.click(await within(traceDialog).findByRole('button', { name: 'Open Experiment relevance score' }));

      expect(traceSideViewLabel(traceDialog)).toMatch(/scores \(1\)/i);
      expect(screen.queryByText('Matches the experiment result score')).toBeNull();
    });

    it('shows selected-span feedback inside the trace drawer stacked over the result', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      const dialog = await findResultPanel('res-1');
      fireEvent.click(await screen.findByRole('button', { name: 'See trace' }));
      // The trace opens as a wide sibling drawer on top of the result drawer.
      const traceDialog = await screen.findByRole('dialog', { name: 'Trace experiment-trace-1' });
      expect(traceDialog.className).toContain('w-4/5');
      expect(traceDialog.getAttribute('data-depth')).toBe('2');
      expect(dialog.isConnected).toBe(true);

      fireEvent.click(await screen.findByText('Experiment tool call'));
      const spanHeading = await screen.findByRole('heading', { name: /child1/ });
      const spanSection = spanHeading.closest('section');
      if (!spanSection) throw new Error('Expected span detail section');
      expect(traceDialog.contains(spanSection)).toBe(true);

      const spanFeedbackTab = await within(spanSection).findByRole('tab', { name: /^feedback \(1\)/i });
      fireEvent.click(spanFeedbackTab);
      expect(await screen.findByText('Child span feedback for the tool call')).toBeDefined();

      // Re-clicking the selected span toggles the span column away.
      fireEvent.click(screen.getByText('Experiment tool call'));
      await waitFor(() => expect(screen.queryByRole('heading', { name: /child1/ })).toBeNull());
      expect(screen.getByText('Experiment agent run')).toBeDefined();
    });

    it('shows the span details inside the shared trace card', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      const dialog = await findResultPanel('res-1');
      fireEvent.click(await screen.findByRole('button', { name: 'See trace' }));
      fireEvent.click(await screen.findByText('Experiment tool call'));

      const spanHeading = await screen.findByRole('heading', { name: /child1/ });
      // Span details render as a column of the trace drawer, not as a drawer of their own.
      const traceDialog = screen.getByRole('dialog', { name: 'Trace experiment-trace-1' });
      expect(traceDialog.contains(spanHeading)).toBe(true);
      // The result sits inline in the side panel, so the trace drawer is the only dialog.
      expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(1);
      await waitFor(() => expect(screen.queryByText('Loading span details...')).toBeNull());
      expect(dialog.isConnected).toBe(true);
    });

    it('navigates between adjacent spans inside the shared trace card', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      await findResultPanel('res-1');
      fireEvent.click(await screen.findByRole('button', { name: 'See trace' }));
      fireEvent.click(await screen.findByText('Experiment tool call'));
      expect(await screen.findByRole('heading', { name: /child1/ })).toBeDefined();

      fireEvent.click(screen.getByLabelText('Go to previous span'));
      expect(await screen.findByRole('heading', { name: /root01/ })).toBeDefined();

      fireEvent.click(screen.getByLabelText('Go to next span'));
      expect(await screen.findByRole('heading', { name: /child1/ })).toBeDefined();
    });

    it('closes span details without closing the trace card', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      const dialog = await findResultPanel('res-1');
      fireEvent.click(await screen.findByRole('button', { name: 'See trace' }));
      fireEvent.click(await screen.findByText('Experiment tool call'));
      expect(await screen.findByRole('heading', { name: /child1/ })).toBeDefined();

      // Re-clicking the selected span toggles the span column away.
      fireEvent.click(screen.getByText('Experiment tool call'));

      await waitFor(() => expect(screen.queryByRole('heading', { name: /child1/ })).toBeNull());
      expect(screen.getByText('Experiment agent run')).toBeDefined();
      expect(dialog.isConnected).toBe(true);
    });

    it('closes the trace card without closing the result panel', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      const dialog = await findResultPanel('res-1');
      fireEvent.click(await screen.findByRole('button', { name: 'See trace' }));
      expect(await screen.findByText('Experiment agent run')).toBeDefined();

      const traceSection = screen.getByText('Experiment agent run').closest('section');
      if (!traceSection) throw new Error('Expected trace section');
      fireEvent.click(within(traceSection).getByLabelText('Close trace'));

      await waitFor(() => expect(screen.queryByText('Experiment agent run')).toBeNull());
      expect(dialog.isConnected).toBe(true);
      expect(dialog.textContent).toContain('first question');
    });
  });

  describe('keyboard navigation while an item is open (regardless of focus)', () => {
    it('navigates to the next item on PageDown and previous on PageUp from anywhere', async () => {
      const { router } = renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-2`);

      const dialog = await findResultPanel('res-2');
      expect(dialog.textContent).toContain('second question');

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

      const dialog = await findResultPanel('res-3');
      expect(dialog.textContent).toContain('third question');

      fireEvent.keyDown(document.body, { key: 'PageDown' });
      expect(router.state.location.pathname).toBe(`/experiments/${EXPERIMENT_ID}/items/item-3`);
    });

    it('closes the panel on Escape', async () => {
      const { router } = renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-2`);

      const dialog = await findResultPanel('res-2');
      expect(dialog.textContent).toContain('second question');

      fireEvent.keyDown(document.body, { key: 'Escape' });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/experiments/${EXPERIMENT_ID}`);
      });
    });

    it('ignores keys typed into an input field', async () => {
      const { router } = renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-2`);
      await findResultPanel('res-2');

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      fireEvent.keyDown(input, { key: 'PageDown' });
      input.remove();

      expect(router.state.location.pathname).toBe(`/experiments/${EXPERIMENT_ID}/items/item-2`);
    });
  });

  describe('when the user completes a needs-review result', () => {
    it('marks the result complete from the panel header', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-3`);

      const dialog = await findResultPanel('res-3');
      expect(dialog.textContent).toContain('third question');

      expect(within(dialog).queryByRole('button', { name: /^review$/i })).toBeNull();
      expect(within(dialog).getByRole('button', { name: /mark as reviewed/i })).toBeDefined();
    });
  });

  describe('when the opened trace has a span whose metadata holds the searched term', { timeout: 15_000 }, () => {
    it('keeps only the span matching the metadata text in the trace drawer search', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/light`, () =>
          HttpResponse.json(experimentTraceSpansWithMetadata),
        ),
      );
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);
      await findResultPanel('res-1');
      fireEvent.click(await screen.findByRole('button', { name: 'See trace' }));
      const traceDialog = await screen.findByRole('dialog', { name: 'Trace experiment-trace-1' });
      expect(await within(traceDialog).findByText('Experiment model call')).toBeDefined();

      fireEvent.change(within(traceDialog).getByPlaceholderText('Search spans...'), {
        target: { value: 'zanzibar-payload-term' },
      });

      await waitFor(() => expect(within(traceDialog).queryByText('Experiment model call')).toBeNull());
      expect(within(traceDialog).getAllByText('Experiment tool call').length).toBeGreaterThan(0);
    });
  });
});
