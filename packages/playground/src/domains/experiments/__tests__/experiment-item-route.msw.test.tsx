import type { GetMetricAggregateArgs, GetMetricAggregateResponse } from '@mastra/client-js';
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
import { renamedPostgresWithMetrics } from '@/domains/configuration/hooks/__tests__/fixtures/observability-storage-capabilities';
import ExperimentPage from '@/pages/experiments/experiment';
import ExperimentItemPage from '@/pages/experiments/experiment/item';
import ReviewQueuePage from '@/pages/experiments/review-queue';
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
      { path: '/experiments/review-queue', element: <ReviewQueuePage /> },
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

let metricRequests: GetMetricAggregateArgs[] = [];

const metricAggregateByAggregation: Record<string, GetMetricAggregateResponse> = {
  sum: { value: 12400, estimatedCost: 0.0123, costUnit: 'USD' },
  avg: { value: 1850 },
  count: { value: 42 },
};

beforeEach(() => {
  metricRequests = [];
  server.use(
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(renamedPostgresWithMetrics)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/aggregate`, async ({ request }) => {
      const body = (await request.json()) as GetMetricAggregateArgs;
      metricRequests.push(body);
      return HttpResponse.json(metricAggregateByAggregation[body.aggregation] ?? { value: null });
    }),
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

describe('experiment item sub-route', () => {
  describe('when the experiment page renders', () => {
    it('shows results directly with no tabs', async () => {
      renderExperimentRoute();

      await screen.findByText('item-2');
      expect(screen.queryByRole('tab')).toBeNull();
    });
  });

  describe('given the experiment route on a metrics-capable store', () => {
    it('when the page loads, then it requests metric aggregates filtered by the route experimentId and renders Tokens/Latency in the meta bar', async () => {
      renderExperimentRoute();

      expect(await screen.findByText('Tokens')).toBeDefined();
      expect(await screen.findByText('12.4K')).toBeDefined();
      expect(screen.getByText('Latency (avg)')).toBeDefined();
      expect(await screen.findByText('1.9s')).toBeDefined();

      expect(metricRequests.length).toBeGreaterThanOrEqual(3);
      for (const body of metricRequests) {
        expect(body.filters).toEqual({ experimentId: EXPERIMENT_ID });
      }
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

    it('opens the item detail panel as a dialog', async () => {
      renderExperimentRoute();

      fireEvent.click(await screen.findByText('item-2'));

      const dialog = await screen.findByRole('dialog');
      expect(dialog.textContent).toContain('second question');
    });

    it('closes the panel when the open item is clicked again', async () => {
      const { router } = renderExperimentRoute();

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

      fireEvent.click(await screen.findByRole('checkbox', { name: 'Select result item-1' }));

      expect(await screen.findByRole('button', { name: 'Flag 1 to review' })).toBeDefined();
      expect(screen.queryByText('1 selected')).toBeNull();
    });

    it('only shows the selection actions once something is selected', async () => {
      renderExperimentRoute();

      // Selecting is what reveals the actions, so no bulk-selection affordance is needed beforehand.
      expect(await screen.findByRole('checkbox', { name: 'Select result item-1' })).toBeDefined();
      expect(screen.queryByRole('button', { name: /Flag \d+ to review/ })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
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

  describe('when the user edits tags from the open result panel', () => {
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

    it('removes a tag from the metadata row', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-2`);
      const dialog = await screen.findByRole('dialog');

      fireEvent.click(await within(dialog).findByRole('button', { name: 'Remove tag alpha' }));

      await waitFor(() => {
        expect(patches).toEqual([{ resultId: 'res-2', body: { tags: [] } }]);
      });
    });

    it('adds a known tag from the metadata row picker', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);
      const dialog = await screen.findByRole('dialog');

      fireEvent.click(await within(dialog).findByRole('combobox'));
      const option = await screen.findByRole('option', { name: 'alpha' });
      fireEvent.pointerDown(option, { pointerType: 'mouse' });
      fireEvent.click(option, { detail: 1 });

      await waitFor(() => {
        expect(patches).toEqual([{ resultId: 'res-1', body: { tags: ['alpha'] } }]);
      });
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

    it('shows a not-found state for an unknown item id', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/does-not-exist`);

      const dialog = await screen.findByRole('dialog');
      await waitFor(() => {
        expect(dialog.textContent).toContain('Item not found');
      });
    });
  });

  describe('result panel Feedback tab', () => {
    it('shows a needs-review dot as soon as the panel opens when a trace feedback needs review', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      const dialog = await screen.findByRole('dialog');
      const feedbackTab = await within(dialog).findByRole('tab', { name: /^feedback/i });
      await waitFor(() => expect(within(feedbackTab).getByTestId('needs-review-dot')).toBeDefined());
    });

    it('shows no dot when every trace feedback is already reviewed', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () =>
          HttpResponse.json({
            ...experimentTraceFeedback,
            feedback: experimentTraceFeedback.feedback.map(item => ({ ...item, reviewStatus: 'reviewed' })),
          }),
        ),
      );
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      const dialog = await screen.findByRole('dialog');
      const feedbackTab = await within(dialog).findByRole('tab', { name: /^feedback/i });
      fireEvent.click(feedbackTab);
      expect(await screen.findByText('Trace feedback for the experiment run')).toBeDefined();
      expect(within(feedbackTab).queryByTestId('needs-review-dot')).toBeNull();
    });
  });

  describe('when the user opens a result trace and selects a span', () => {
    it('shows trace feedback (with a needs-review dot) and anchor-span scores with a badge count', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      await screen.findByRole('dialog');
      fireEvent.click(await screen.findByRole('button', { name: 'Trace' }));

      const scoresTab = await screen.findByRole('tab', { name: /scores \(1\)/i });
      const feedbackTab = screen.getAllByRole('tab', { name: /^feedback/i }).at(-1)!;
      expect(within(feedbackTab).getByTestId('needs-review-dot')).toBeDefined();

      fireEvent.click(scoresTab);
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
      fireEvent.click(await screen.findByRole('tab', { name: /scores \(1\)/i }));
      fireEvent.click(await screen.findByRole('button', { name: /0\.9Experiment relevance/i }));

      expect(await screen.findByText('Matches the experiment result score')).toBeDefined();
    });

    it('keeps the trace scores open when a trace score has no experiment score match', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      await screen.findByRole('dialog');
      fireEvent.click(await screen.findByRole('button', { name: 'Trace' }));
      const scoresTab = await screen.findByRole('tab', { name: /scores \(1\)/i });
      fireEvent.click(scoresTab);
      fireEvent.click(await screen.findByRole('button', { name: /0\.9Experiment relevance/i }));

      expect(scoresTab.getAttribute('aria-selected')).toBe('true');
      expect(screen.queryByText('Matches the experiment result score')).toBeNull();
      expect(screen.getByRole('tab', { name: /scores \(1\)/i })).toBeDefined();
    });

    it('shows selected-span feedback and widens the route overlay', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(await screen.findByRole('button', { name: 'Trace' }));
      expect(dialog.parentElement?.className).toContain('grid-cols-[1fr_1fr]');

      fireEvent.click(await screen.findByText('Experiment tool call'));
      const spanHeading = await screen.findByRole('heading', { name: /span-child/ });
      const spanSection = spanHeading.closest('section');
      if (!spanSection) throw new Error('Expected span detail section');

      expect(dialog.parentElement?.className).toContain('grid-cols-[1fr_4fr]');
      expect(spanSection.className).toContain('rounded-none');
      expect(spanSection.className).toContain('border-0');
      expect(spanSection.className).toContain('bg-transparent');

      const spanFeedbackTab = await within(spanSection).findByRole('tab', { name: /^feedback/i });
      expect(within(spanFeedbackTab).getByTestId('needs-review-dot')).toBeDefined();
      fireEvent.click(spanFeedbackTab);
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

      expect(await screen.findByRole('heading', { name: /span-child/ })).toBeDefined();
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
      expect(await screen.findByRole('heading', { name: /span-child/ })).toBeDefined();

      fireEvent.click(screen.getByLabelText('Previous span'));
      expect(await screen.findByRole('heading', { name: /span-root/ })).toBeDefined();

      fireEvent.click(screen.getByLabelText('Next span'));
      expect(await screen.findByRole('heading', { name: /span-child/ })).toBeDefined();
    });

    it('closes span details without closing the trace card', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-1`);

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(await screen.findByRole('button', { name: 'Trace' }));
      fireEvent.click(await screen.findByText('Experiment tool call'));
      expect(await screen.findByRole('heading', { name: /span-child/ })).toBeDefined();

      const spanSection = screen.getByRole('heading', { name: /span-child/ }).closest('section');
      if (!spanSection) throw new Error('Expected span detail section');
      fireEvent.click(within(spanSection).getByLabelText('Close Panel'));

      await waitFor(() => expect(screen.queryByRole('heading', { name: /span-child/ })).toBeNull());
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

  describe('when the user completes a needs-review result', () => {
    it('marks the result complete from the panel header', async () => {
      renderExperimentRoute(`/experiments/${EXPERIMENT_ID}/items/item-3`);

      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog.textContent).toContain('third question'));

      expect(within(dialog).queryByRole('button', { name: /^review$/i })).toBeNull();
      expect(within(dialog).getByRole('button', { name: /mark as reviewed/i })).toBeDefined();
    });
  });
});
