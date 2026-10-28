// @vitest-environment jsdom
import type { AggregateSpansResponse, GetObservabilityCapabilitiesResponse, QuerySpansResult } from '@mastra/client-js';
import { planSpanAggregate, spanAggregateRequestSchema } from '@mastra/core/storage';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyEntityNames,
  emptyEnvironments,
  emptySpanRows,
  endedSpan,
  firstListedSpan,
  spanAggregateCapabilities,
  spanAggregateError,
  spanCountsAggregate,
  spanHeadPage,
  spanQueryCapabilities,
  spanRowsPage,
} from '../../__tests__/fixtures/spans';
import type { SpanSelection } from '../span-detail-panel';
import { SpansExplorerBody } from '../spans-explorer-body';
import type { SpansExplorerPanelArgs } from '../spans-explorer-body';
import { OBSERVABILITY_LIST_POLL_INTERVAL_MS } from '@/domains/observability/list-polling';
import { useTraceColumnPreferences } from '@/domains/traces/hooks/use-trace-column-preferences';
import { DEFAULT_TRACE_COLUMN_PREFERENCES } from '@/domains/traces/trace-list-columns';
import { useFixedChartSize } from '@/test/chart-size';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const SPANS_QUERY_URL = `${TEST_BASE_URL}/api/observability/spans/query`;
const SPANS_AGGREGATE_URL = `${TEST_BASE_URL}/api/observability/spans/aggregate`;

const setHandlers = (spans: QuerySpansResult) =>
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(spanQueryCapabilities)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/entity-names`, () => HttpResponse.json(emptyEntityNames)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () => HttpResponse.json(emptyEnvironments)),
    http.post(SPANS_QUERY_URL, () => HttpResponse.json(spans)),
  );

// Rendered with no router: the body only talks to its host through props.
const renderBody = (selection?: SpanSelection) => {
  const onSelectionChange = vi.fn<(selection: SpanSelection | undefined) => void>();
  const renderPanel = vi.fn<(args: SpansExplorerPanelArgs) => null>(() => null);
  renderWithProviders(
    <SpansExplorerBody selection={selection} onSelectionChange={onSelectionChange} renderPanel={renderPanel} />,
  );
  return { onSelectionChange, renderPanel };
};

/** The spans body next to a readout of the traces page's saved columns, which live under their own key. */
function BodyWithTracesColumns() {
  const traces = useTraceColumnPreferences();
  return (
    <>
      <SpansExplorerBody selection={undefined} onSelectionChange={() => {}} renderPanel={() => null} />
      <output data-testid="traces-columns">{traces.preferences.visibleColumns.join(',')}</output>
    </>
  );
}

const openColumnsMenu = async () => {
  const button = await screen.findByRole<HTMLButtonElement>('button', { name: 'Columns' });
  await waitFor(() => expect(button.disabled).toBe(false));
  fireEvent.click(button);
};

describe('SpansExplorerBody', () => {
  useFixedChartSize(1200, 800);
  // Base UI ScrollArea calls getAnimations once a ResizeObserver exists; jsdom has no Web Animations API.
  beforeAll(() => {
    Element.prototype.getAnimations ??= () => [];
  });
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('when the store returns span rows', () => {
    it('puts the Columns button ahead of the filters', async () => {
      setHandlers(spanRowsPage);

      renderBody();
      const columns = await screen.findByRole('button', { name: 'Columns' });

      const dateChip = document.querySelector('[data-slot="filter-bar-chip"]');
      if (!dateChip) throw new Error('date chip not rendered');
      expect(columns.compareDocumentPosition(dateChip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('lists each span', async () => {
      setHandlers(spanRowsPage);

      renderBody();

      expect(await screen.findByText('agent run: weather')).toBeTruthy();
      expect(screen.getByText('tool: get-weather')).toBeTruthy();
    });

    it('hands the listed spans to the panel, in list order', async () => {
      setHandlers(spanRowsPage);

      const { renderPanel } = renderBody();
      await screen.findByText('agent run: weather');

      expect(renderPanel).toHaveBeenLastCalledWith(
        expect.objectContaining({
          spans: [
            { traceId: 'trace-1', spanId: 'span-1' },
            { traceId: 'trace-1', spanId: 'span-2' },
          ],
        }),
      );
    });
  });

  describe('when a span ends while the page is open', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('appears in the list on the next poll', async () => {
      setHandlers(spanRowsPage);
      server.use(
        http.post(SPANS_QUERY_URL, async ({ request }) => {
          const body = (await request.json()) as { orderBy?: Array<{ field: string }> };
          return HttpResponse.json(body.orderBy?.[0]?.field === 'endedAt' ? spanHeadPage : spanRowsPage);
        }),
      );
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });

      renderBody();
      await screen.findByText('agent run: weather');
      expect(screen.queryByText(endedSpan.name)).toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(OBSERVABILITY_LIST_POLL_INTERVAL_MS);
      });

      expect(await screen.findByText(endedSpan.name)).toBeTruthy();
    });
  });

  describe('when a span row is clicked', () => {
    it('asks the host to open that span', async () => {
      setHandlers(spanRowsPage);

      const { onSelectionChange } = renderBody();
      fireEvent.click(await screen.findByText('tool: get-weather'));

      expect(onSelectionChange).toHaveBeenCalledWith({ traceId: 'trace-1', spanId: 'span-2' });
    });
  });

  describe('when the open span row is clicked again', () => {
    it('asks the host to close the panel', async () => {
      setHandlers(spanRowsPage);

      const { onSelectionChange } = renderBody(firstListedSpan);
      fireEvent.click(await screen.findByText('agent run: weather'));

      expect(onSelectionChange).toHaveBeenCalledWith(undefined);
    });
  });

  describe('when the span query fails', () => {
    it('shows the error in place of the list', async () => {
      setHandlers(spanRowsPage);
      server.use(http.post(SPANS_QUERY_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

      renderBody();

      expect(await screen.findByText('Failed to load spans')).toBeTruthy();
    });
  });

  describe('when the window has no spans', () => {
    it('shows the empty state', async () => {
      setHandlers(emptySpanRows);

      renderBody();

      expect(await screen.findByRole('heading', { name: 'No spans for the last 7 days' })).toBeTruthy();
    });
  });

  describe('when the user opens the Columns menu', () => {
    it('offers the span columns, Model and Provider included', async () => {
      setHandlers(spanRowsPage);

      renderBody();
      await openColumnsMenu();

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Model' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Provider' })).toBeTruthy();
      expect(screen.getByRole('menuitemcheckbox', { name: 'Thread ID' })).toBeTruthy();
    });

    it('offers neither usage nor metadata columns', async () => {
      setHandlers(spanRowsPage);

      renderBody();
      await openColumnsMenu();
      await screen.findByRole('menuitemcheckbox', { name: 'Model' });

      expect(screen.queryByText('Usage columns')).toBeNull();
      expect(screen.queryByText('Metadata columns')).toBeNull();
    });
  });

  describe('when the user turns on the Model and Provider columns', () => {
    it("shows each span's model and provider in the list", async () => {
      setHandlers(spanRowsPage);

      renderBody();
      await openColumnsMenu();
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Model' }));
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Provider' }));

      expect(await screen.findByText('gpt-5.6')).toBeTruthy();
      expect(screen.getByText('openai')).toBeTruthy();
    });

    it('keeps the choice for the next visit, without touching the traces columns', async () => {
      setHandlers(spanRowsPage);

      const { unmount } = renderWithProviders(<BodyWithTracesColumns />);
      await openColumnsMenu();
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Model' }));
      await screen.findByText('gpt-5.6');
      unmount();

      renderWithProviders(<BodyWithTracesColumns />);

      expect(await screen.findByText('gpt-5.6')).toBeTruthy();
      expect(screen.getByTestId('traces-columns').textContent).toBe(
        DEFAULT_TRACE_COLUMN_PREFERENCES.visibleColumns.join(','),
      );
    });
  });
});

type SpanQueryBody = { timeRange: { from: string; to: string }; where?: unknown; orderBy?: Array<{ field: string }> };
type AggregateBody = { timeRange: { from: string; to: string }; where?: unknown };

describe('SpansExplorerBody histogram', () => {
  useFixedChartSize(1200, 800);
  beforeAll(() => {
    Element.prototype.getAnimations ??= () => [];
  });
  beforeEach(() => {
    window.localStorage.clear();
  });

  const onSpanQuery = vi.fn<(body: SpanQueryBody) => void>();
  const onAggregate = vi.fn<(body: AggregateBody) => void>();
  beforeEach(() => {
    onSpanQuery.mockClear();
    onAggregate.mockClear();
  });

  const setHistogramHandlers = ({
    capabilities = spanAggregateCapabilities,
    spans = spanRowsPage,
    aggregate = body => HttpResponse.json<AggregateSpansResponse>(spanCountsAggregate(body.timeRange)),
  }: {
    capabilities?: GetObservabilityCapabilitiesResponse;
    spans?: QuerySpansResult;
    aggregate?: (body: AggregateBody) => Response;
  } = {}) =>
    server.use(
      http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(capabilities)),
      http.get(`${TEST_BASE_URL}/api/observability/discovery/entity-names`, () => HttpResponse.json(emptyEntityNames)),
      http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () => HttpResponse.json(emptyEnvironments)),
      http.post(SPANS_QUERY_URL, async ({ request }) => {
        const body = (await request.json()) as SpanQueryBody;
        // Head polls (`endedAt desc`) are the list's live updates, not its query.
        if (body.orderBy?.[0]?.field !== 'endedAt') onSpanQuery(body);
        return HttpResponse.json(spans);
      }),
      // Validated like the server does, so a request the store would reject fails the test.
      http.post(SPANS_AGGREGATE_URL, async ({ request }) => {
        const parsed = spanAggregateRequestSchema.safeParse(await request.json());
        if (!parsed.success) return HttpResponse.json({ error: parsed.error.message }, { status: 400 });
        try {
          planSpanAggregate(parsed.data);
        } catch (error) {
          return HttpResponse.json({ error: String(error) }, { status: 400 });
        }
        onAggregate(parsed.data);
        return aggregate(parsed.data);
      }),
    );

  const renderSettled = async () => {
    const { queryClient } = renderWithProviders(
      <SpansExplorerBody selection={undefined} onSelectionChange={() => {}} renderPanel={() => null} />,
    );
    await screen.findByText('agent run: weather');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  };

  const chart = () => screen.queryByRole('region', { name: 'Spans over time' });

  describe('when the server cannot aggregate spans', () => {
    it('does not render the chart', async () => {
      setHistogramHandlers({ capabilities: spanQueryCapabilities });

      await renderSettled();

      expect(chart()).toBeNull();
    });

    it('never calls the aggregate endpoint', async () => {
      setHistogramHandlers({ capabilities: spanQueryCapabilities });

      await renderSettled();

      expect(onAggregate).not.toHaveBeenCalled();
    });
  });

  describe('when the server aggregates spans', () => {
    it('shows span and error totals', async () => {
      setHistogramHandlers();

      await renderSettled();

      const region = await screen.findByRole('region', { name: 'Spans over time' });
      expect(await within(region).findByText(/21 spans/i)).toBeTruthy();
      expect(within(region).getByText(/3 errors/i)).toBeTruthy();
    });

    it('sends the same time range and filters as the list query', async () => {
      setHistogramHandlers();

      await renderSettled();

      const list = onSpanQuery.mock.lastCall?.[0];
      const aggregate = onAggregate.mock.lastCall?.[0];
      expect(aggregate?.timeRange).toEqual(list?.timeRange);
      expect(aggregate?.where).toEqual(list?.where);
    });
  });

  describe('when the user picks another time range', () => {
    it('refetches the chart with the new range', async () => {
      setHistogramHandlers();
      await renderSettled();
      await screen.findByRole('region', { name: 'Spans over time' });
      onAggregate.mockClear();

      const dateChip = document.querySelector<HTMLElement>('[data-slot="filter-bar-chip"]');
      if (!dateChip) throw new Error('date chip not rendered');
      fireEvent.click(within(dateChip).getByRole('button', { name: 'Value: Last 7 days', hidden: true }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Last 24 hours', hidden: true }));

      await waitFor(() => expect(onAggregate).toHaveBeenCalled());
      const timeRange = onAggregate.mock.lastCall?.[0].timeRange;
      expect(Date.parse(timeRange?.to ?? '') - Date.parse(timeRange?.from ?? '')).toBe(24 * 60 * 60 * 1000);
      expect(timeRange).toEqual(onSpanQuery.mock.lastCall?.[0].timeRange);
    });
  });

  describe('when the aggregate request fails', () => {
    it('shows an inline error in the chart', async () => {
      setHistogramHandlers({ aggregate: () => HttpResponse.json(spanAggregateError, { status: 400 }) });

      await renderSettled();

      const region = await screen.findByRole('region', { name: 'Spans over time' });
      expect(await within(region).findByText("Couldn't load the chart.")).toBeTruthy();
    });

    it('still lists the spans', async () => {
      setHistogramHandlers({ aggregate: () => HttpResponse.json(spanAggregateError, { status: 400 }) });

      await renderSettled();

      expect(screen.getByText('tool: get-weather')).toBeTruthy();
    });
  });

  describe('when the window has no spans', () => {
    it('shows the empty state without the chart', async () => {
      setHistogramHandlers({ spans: emptySpanRows });

      renderWithProviders(
        <SpansExplorerBody selection={undefined} onSelectionChange={() => {}} renderPanel={() => null} />,
      );

      expect(await screen.findByRole('heading', { name: 'No spans for the last 7 days' })).toBeTruthy();
      expect(chart()).toBeNull();
    });
  });
});
