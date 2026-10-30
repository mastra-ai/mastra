// @vitest-environment jsdom
import type {
  AggregateSpansResponse,
  GetObservabilityCapabilitiesResponse,
  QuerySpansInput,
  QuerySpansResult,
} from '@mastra/client-js';
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
  limitedSpanPage,
  noStreamingTimingsSortSpanCapabilities,
  noStreamingTimingsSpanCapabilities,
  spanAggregateCapabilities,
  spanAggregateError,
  spanCountsAggregate,
  spanHeadPage,
  spanModelCapabilities,
  spanOutcomeCapabilities,
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
import { SearchParamsHost } from '@/test/search-params-host';

const SPANS_QUERY_URL = `${TEST_BASE_URL}/api/observability/spans/query`;
const SPANS_AGGREGATE_URL = `${TEST_BASE_URL}/api/observability/spans/aggregate`;

const setHandlers = (
  spans: QuerySpansResult,
  capabilities: GetObservabilityCapabilitiesResponse = spanQueryCapabilities,
) =>
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(capabilities)),
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

/** The body inside a stand-in router whose URL starts as `initial`; returns each list query sent. */
const renderBodyAtUrl = (initial: string) => {
  const queries: QuerySpansInput[] = [];
  server.use(
    http.post(SPANS_QUERY_URL, async ({ request }) => {
      const body = (await request.json()) as QuerySpansInput;
      // The poll for newly ended spans orders by endedAt; only the list query is kept.
      if (body.orderBy?.[0]?.field !== 'endedAt') queries.push(body);
      return HttpResponse.json(spanRowsPage);
    }),
  );
  renderWithProviders(
    <SearchParamsHost initial={initial}>
      {urlState => (
        <SpansExplorerBody
          selection={undefined}
          onSelectionChange={() => {}}
          renderPanel={() => null}
          urlState={urlState}
        />
      )}
    </SearchParamsHost>,
  );
  return { queries };
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

const turnOnStreamingColumns = async () => {
  await openColumnsMenu();
  fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Time to first chunk' }));
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Time to first token' }));
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
};

const currentSearchParams = () => new URLSearchParams(screen.getByTestId('search-params').textContent ?? '');

describe('SpansExplorerBody', () => {
  useFixedChartSize(1200, 800);
  // Base UI ScrollArea calls getAnimations once a ResizeObserver exists; jsdom has no Web Animations API.
  beforeAll(() => {
    Element.prototype.getAnimations ??= () => [];
  });
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('when the store records span outcomes', () => {
    const spanQueryBodies = vi.fn<(body: unknown) => void>();
    const setOutcomeHandlers = (capabilities: GetObservabilityCapabilitiesResponse) => {
      setHandlers(limitedSpanPage);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(capabilities)),
        http.post(SPANS_QUERY_URL, async ({ request }) => {
          spanQueryBodies(await request.json());
          return HttpResponse.json(limitedSpanPage);
        }),
      );
    };
    const filterInput = () => screen.getByRole('combobox', { name: 'Add filter' });

    afterEach(() => spanQueryBodies.mockClear());

    it('shows each span outcome with its stop reason', async () => {
      setOutcomeHandlers(spanOutcomeCapabilities);

      renderBody();

      const row = await screen.findByRole('button', { name: /agent run: weather/ });
      expect(within(row).getByText('Limit')).toBeTruthy();
      expect(within(row).getByText('max_steps')).toBeTruthy();
    });

    it('queries spans with no recorded outcome', async () => {
      setOutcomeHandlers(spanOutcomeCapabilities);
      renderBody();
      await screen.findByText('agent run: weather');

      filterInput().focus();
      fireEvent.change(filterInput(), { target: { value: 'Outcome' } });
      await screen.findByRole('option', { name: 'Outcome' });
      fireEvent.keyDown(filterInput(), { key: 'Enter' });
      fireEvent.change(filterInput(), { target: { value: 'is not recorded' } });
      await screen.findByRole('option', { name: 'is not recorded' });
      fireEvent.keyDown(filterInput(), { key: 'Enter' });

      await waitFor(() =>
        expect(spanQueryBodies).toHaveBeenLastCalledWith(
          expect.objectContaining({ where: { op: 'and', args: [{ op: 'notExists', path: 'outcome' }] } }),
        ),
      );
    });

    it('does not offer outcome filters when the store cannot filter on them', async () => {
      setOutcomeHandlers(spanQueryCapabilities);
      renderBody();
      await screen.findByText('agent run: weather');

      filterInput().focus();
      fireEvent.change(filterInput(), { target: { value: 'Status' } });
      await screen.findByRole('option', { name: 'Status' });
      fireEvent.change(filterInput(), { target: { value: 'Outcome' } });

      expect(screen.queryByRole('option', { name: 'Outcome' })).toBeNull();
    });
  });

  describe('when the store filters spans by model and provider', () => {
    const spanQueryBodies = vi.fn<(body: unknown) => void>();
    const setModelHandlers = (capabilities: GetObservabilityCapabilitiesResponse) => {
      setHandlers(spanRowsPage, capabilities);
      server.use(
        http.post(SPANS_QUERY_URL, async ({ request }) => {
          spanQueryBodies(await request.json());
          return HttpResponse.json(spanRowsPage);
        }),
      );
    };
    const filterInput = () => screen.getByRole('combobox', { name: 'Add filter' });

    afterEach(() => spanQueryBodies.mockClear());

    it('queries spans with no recorded provider', async () => {
      setModelHandlers(spanModelCapabilities);
      renderBody();
      await screen.findByText('agent run: weather');

      filterInput().focus();
      fireEvent.change(filterInput(), { target: { value: 'Provider' } });
      await screen.findByRole('option', { name: 'Provider' });
      fireEvent.keyDown(filterInput(), { key: 'Enter' });
      fireEvent.change(filterInput(), { target: { value: 'does not exist' } });
      await screen.findByRole('option', { name: 'does not exist' });
      fireEvent.keyDown(filterInput(), { key: 'Enter' });

      await waitFor(() =>
        expect(spanQueryBodies).toHaveBeenLastCalledWith(
          expect.objectContaining({ where: { op: 'and', args: [{ op: 'notExists', path: 'provider' }] } }),
        ),
      );
    });

    it('does not offer model filters when the store cannot filter on them', async () => {
      setModelHandlers(spanQueryCapabilities);
      renderBody();
      await screen.findByText('agent run: weather');

      filterInput().focus();
      fireEvent.change(filterInput(), { target: { value: 'Status' } });
      await screen.findByRole('option', { name: 'Status' });
      fireEvent.change(filterInput(), { target: { value: 'Provider' } });

      expect(screen.queryByRole('option', { name: 'Provider' })).toBeNull();
    });
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

  describe('when the user turns on the time to first chunk and time to first token columns', () => {
    it('labels them TTFC and TTFT', async () => {
      setHandlers(spanRowsPage);

      renderBody();
      await turnOnStreamingColumns();

      expect(await screen.findByText('TTFC')).toBeTruthy();
      expect(screen.getByText('TTFT')).toBeTruthy();
    });

    it('shows how long each span took to stream its first chunk and token', async () => {
      setHandlers(spanRowsPage);

      renderBody();
      await turnOnStreamingColumns();

      const row = (await screen.findByText('agent run: weather')).closest('[role="button"], button');
      expect(row).toBeTruthy();
      expect(within(row as HTMLElement).getByText('412ms')).toBeTruthy();
      expect(within(row as HTMLElement).getByText('538ms')).toBeTruthy();
    });
  });

  describe('when the stored columns include time to first chunk and token but the store records neither', () => {
    it('leaves both columns out of the list', async () => {
      window.localStorage.clear();
      setHandlers(spanRowsPage);
      const { unmount } = renderWithProviders(<BodyWithTracesColumns />);
      await openColumnsMenu();
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Time to first chunk' }));
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Time to first token' }));
      await screen.findByText('412ms');
      unmount();

      setHandlers(spanRowsPage, noStreamingTimingsSpanCapabilities);
      renderBody();

      expect(await screen.findByText('agent run: weather')).toBeTruthy();
      expect(screen.queryByText('TTFC')).toBeNull();
      expect(screen.queryByText('TTFT')).toBeNull();
      expect(screen.queryByText('412ms')).toBeNull();
    });
  });

  describe('when the URL filters on time to first chunk and time to first token', () => {
    const STREAMING_FILTERS =
      'filter.timeToFirstChunkMs=500&filter.timeToFirstChunkMs.op=lte&filter.timeToFirstTokenMs=800&filter.timeToFirstTokenMs.op=gt';
    const paths = (where: unknown) => JSON.stringify(where ?? null);

    it('sends both conditions when the store records both', async () => {
      setHandlers(spanRowsPage);

      const { queries } = renderBodyAtUrl(STREAMING_FILTERS);
      await screen.findByText('agent run: weather');

      await waitFor(() =>
        expect(queries.map(query => paths(query.where))).toContainEqual(
          expect.stringMatching(/"timeToFirstChunkMs".*"timeToFirstTokenMs"/),
        ),
      );
    });

    it('leaves both conditions out when the store does not record them', async () => {
      const onCapabilities = vi.fn();
      setHandlers(spanRowsPage, noStreamingTimingsSpanCapabilities);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => {
          onCapabilities();
          return HttpResponse.json(noStreamingTimingsSpanCapabilities);
        }),
      );

      const { queries } = renderBodyAtUrl(STREAMING_FILTERS);
      await screen.findByText('agent run: weather');
      await waitFor(() => expect(onCapabilities).toHaveBeenCalled());

      for (const query of queries) {
        expect(paths(query.where)).not.toContain('timeToFirstChunkMs');
        expect(paths(query.where)).not.toContain('timeToFirstTokenMs');
      }
    });
  });

  describe('when the URL holds a filter, a sort and a time range', () => {
    it('queries spans with them', async () => {
      setHandlers(spanRowsPage);

      const { queries } = renderBodyAtUrl('filter.name=tool%3A+get-weather&sort=startedAt&dir=asc&datePreset=last-24h');
      await screen.findByText('agent run: weather');

      const [query] = queries;
      expect(JSON.stringify(query?.where)).toContain('"tool: get-weather"');
      expect(query?.orderBy).toEqual([{ field: 'startedAt', direction: 'asc' }]);
      const from = new Date(query?.timeRange?.from ?? NaN).getTime();
      expect(Date.now() - from).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(Date.now() - from).toBeLessThan(25 * 60 * 60 * 1000);
    });
  });

  describe('when the user sorts the list by start time', () => {
    it('writes the sort to the URL and keeps the other params', async () => {
      setHandlers(spanRowsPage);

      renderBodyAtUrl('traceId=trace-1&spanId=span-2&filter.name=tool%3A+get-weather');
      fireEvent.click(await screen.findByRole('button', { name: /^Start, sorted descending/ }));

      await waitFor(() =>
        expect(currentSearchParams()).toEqual(
          new URLSearchParams('traceId=trace-1&spanId=span-2&filter.name=tool%3A+get-weather&sort=startedAt&dir=asc'),
        ),
      );
    });
  });

  describe('when the user sorts the list by time to first token', () => {
    it('queries spans fastest first and writes the sort to the URL', async () => {
      setHandlers(spanRowsPage);

      const { queries } = renderBodyAtUrl('');
      await turnOnStreamingColumns();
      fireEvent.click(await screen.findByRole('button', { name: 'Time to first token, not sorted, sort ascending' }));

      await waitFor(() => expect(queries.at(-1)?.orderBy).toEqual([{ field: 'timeToFirstTokenMs', direction: 'asc' }]));
      expect(currentSearchParams().get('sort')).toBe('timeToFirstTokenMs');
      expect(currentSearchParams().get('dir')).toBe('asc');
      expect(
        screen.getByRole('button', { name: 'Time to first token, sorted ascending, sort descending' }),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Start, not sorted, sort ascending' })).toBeTruthy();
    });
  });

  describe('when the user sorts by time to first chunk, then by time to first token', () => {
    it('moves the order from one column to the other', async () => {
      setHandlers(spanRowsPage);

      const { queries } = renderBodyAtUrl('');
      await turnOnStreamingColumns();
      fireEvent.click(await screen.findByRole('button', { name: 'Time to first chunk, not sorted, sort ascending' }));
      await waitFor(() => expect(queries.at(-1)?.orderBy).toEqual([{ field: 'timeToFirstChunkMs', direction: 'asc' }]));

      fireEvent.click(screen.getByRole('button', { name: 'Time to first token, not sorted, sort ascending' }));

      await waitFor(() => expect(queries.at(-1)?.orderBy).toEqual([{ field: 'timeToFirstTokenMs', direction: 'asc' }]));
      expect(screen.getByRole('button', { name: 'Time to first chunk, not sorted, sort ascending' })).toBeTruthy();
    });
  });

  describe('when the URL sorts by time to first chunk but the column is hidden', () => {
    it("lists newest first instead of sorting by a column that isn't shown, without rewriting the URL", async () => {
      setHandlers(spanRowsPage);

      const { queries } = renderBodyAtUrl('sort=timeToFirstChunkMs&dir=asc');
      await screen.findByText('agent run: weather');

      expect(queries.map(query => query.orderBy)).toEqual(
        queries.map(() => [{ field: 'startedAt', direction: 'desc' }]),
      );
      expect(queries.length).toBeGreaterThan(0);
      expect(currentSearchParams().get('sort')).toBe('timeToFirstChunkMs');
    });
  });

  describe('when the store records the timings but cannot sort spans by them', () => {
    it('shows both columns without a sort control', async () => {
      setHandlers(spanRowsPage, noStreamingTimingsSortSpanCapabilities);

      renderBody();
      await turnOnStreamingColumns();

      expect(await screen.findByText('TTFT')).toBeTruthy();
      expect(screen.getByText('TTFC')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /^Time to first (chunk|token),/ })).toBeNull();
    });

    it('lists newest first instead of the sort in the URL', async () => {
      setHandlers(spanRowsPage, noStreamingTimingsSortSpanCapabilities);

      const { queries } = renderBodyAtUrl('sort=timeToFirstTokenMs&dir=asc');
      await turnOnStreamingColumns();
      await screen.findByText('538ms');

      expect(queries.at(-1)?.orderBy).toEqual([{ field: 'startedAt', direction: 'desc' }]);
      expect(screen.getByRole('button', { name: 'Start, sorted descending, sort ascending' })).toBeTruthy();
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

  describe('when the user drags across bars', () => {
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    /** Recharts applies pointer moves on the next animation frame. */
    const moveTo = async (plot: Element, clientX: number) => {
      fireEvent.mouseMove(plot, { clientX, clientY: 20 });
      await act(() => new Promise(resolve => requestAnimationFrame(() => resolve(undefined))));
    };

    it('narrows the list and the chart to the dragged bars', async () => {
      setHistogramHandlers();
      await renderSettled();
      const plot = (await screen.findByRole('region', { name: 'Spans over time' })).querySelector('.recharts-wrapper');
      if (!plot) throw new Error('chart did not render');

      // The rolling week is drawn as two-hour bars (UTC in tests) from the bar holding its start.
      const week = onAggregate.mock.lastCall?.[0].timeRange;
      if (!week) throw new Error('no aggregate request');
      const firstBar = Math.floor(Date.parse(week.from) / TWO_HOURS) * TWO_HOURS;
      const barWidth = 1200 / Math.ceil((Date.parse(week.to) - firstBar) / TWO_HOURS);
      const atBar = (bar: number) => (bar + 0.5) * barWidth;

      await moveTo(plot, atBar(12));
      fireEvent.mouseDown(plot, { clientX: atBar(12), clientY: 20 });
      await moveTo(plot, atBar(23));
      fireEvent.mouseUp(window);

      const zoomed = {
        from: new Date(firstBar + 12 * TWO_HOURS).toISOString(),
        to: new Date(firstBar + 24 * TWO_HOURS).toISOString(),
      };
      await waitFor(() => expect(onAggregate.mock.lastCall?.[0].timeRange).toEqual(zoomed));
      expect(onSpanQuery.mock.lastCall?.[0].timeRange).toEqual(zoomed);

      // The × next to the time range returns to the rolling week.
      fireEvent.click(screen.getByRole('button', { name: 'Reset time range' }));

      await waitFor(() => expect(onAggregate.mock.lastCall?.[0].timeRange).not.toEqual(zoomed));
      const reset = onAggregate.mock.lastCall?.[0].timeRange;
      expect(Date.parse(reset.to) - Date.parse(reset.from)).toBe(7 * 24 * 60 * 60 * 1000);
      expect(onSpanQuery.mock.lastCall?.[0].timeRange).toEqual(reset);
      expect(screen.getByRole('button', { name: 'Value: Last 7 days' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Reset time range' })).toBeNull();
    });

    const DAY = 24 * 60 * 60 * 1000;
    const span = (timeRange?: { from: string; to: string }) =>
      timeRange ? Date.parse(timeRange.to) - Date.parse(timeRange.from) : undefined;
    const pickPreset = async (current: string, next: string) => {
      fireEvent.click(screen.getByRole('button', { name: `Value: ${current}`, hidden: true }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: next, hidden: true }));
    };
    const zoomIn = async () => {
      const before = onAggregate.mock.lastCall?.[0].timeRange;
      const plot = (await screen.findByRole('region', { name: 'Spans over time' })).querySelector('.recharts-wrapper');
      if (!plot) throw new Error('chart did not render');
      await moveTo(plot, 300);
      fireEvent.mouseDown(plot, { clientX: 300, clientY: 20 });
      await moveTo(plot, 500);
      fireEvent.mouseUp(window);
      await waitFor(() => expect(span(onAggregate.mock.lastCall?.[0].timeRange)).toBeLessThan(span(before) ?? 0));
    };

    it('resets a zoom back to the range picked before it', async () => {
      setHistogramHandlers();
      await renderSettled();
      await pickPreset('Last 7 days', 'Last 24 hours');
      await waitFor(() => expect(span(onAggregate.mock.lastCall?.[0].timeRange)).toBe(DAY));

      await zoomIn();
      fireEvent.click(screen.getByRole('button', { name: 'Reset time range' }));

      await waitFor(() => expect(span(onAggregate.mock.lastCall?.[0].timeRange)).toBe(DAY));
      expect(span(onSpanQuery.mock.lastCall?.[0].timeRange)).toBe(DAY);
      expect(screen.getByRole('button', { name: 'Value: Last 24 hours' })).toBeTruthy();
    });

    it('resets nested zooms back to the range picked before the first one', async () => {
      setHistogramHandlers();
      await renderSettled();
      await pickPreset('Last 7 days', 'Last 24 hours');
      await waitFor(() => expect(span(onAggregate.mock.lastCall?.[0].timeRange)).toBe(DAY));

      await zoomIn();
      await zoomIn();
      fireEvent.click(screen.getByRole('button', { name: 'Reset time range' }));

      await waitFor(() => expect(span(onAggregate.mock.lastCall?.[0].timeRange)).toBe(DAY));
      expect(screen.getByRole('button', { name: 'Value: Last 24 hours' })).toBeTruthy();
    });

    it('resets to the default range once the zoom is undone', async () => {
      setHistogramHandlers();
      await renderSettled();
      await pickPreset('Last 7 days', 'Last 24 hours');
      await waitFor(() => expect(span(onAggregate.mock.lastCall?.[0].timeRange)).toBe(DAY));
      await zoomIn();

      fireEvent.click(screen.getByRole('button', { name: 'Reset time range' }));
      await screen.findByRole('button', { name: 'Value: Last 24 hours' });
      fireEvent.click(screen.getByRole('button', { name: 'Reset time range' }));

      expect(await screen.findByRole('button', { name: 'Value: Last 7 days' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Reset time range' })).toBeNull();
    });
  });

  describe('when the user clicks a bar', () => {
    const TWO_HOURS = 2 * 60 * 60 * 1000;

    it('narrows the list and the chart to that bar', async () => {
      setHistogramHandlers();
      await renderSettled();
      const plot = (await screen.findByRole('region', { name: 'Spans over time' })).querySelector('.recharts-wrapper');
      if (!plot) throw new Error('chart did not render');

      // The rolling week is drawn as two-hour bars (UTC in tests) from the bar holding its start.
      const week = onAggregate.mock.lastCall?.[0].timeRange;
      if (!week) throw new Error('no aggregate request');
      const firstBar = Math.floor(Date.parse(week.from) / TWO_HOURS) * TWO_HOURS;
      const barWidth = 1200 / Math.ceil((Date.parse(week.to) - firstBar) / TWO_HOURS);
      const at = { clientX: 12.5 * barWidth, clientY: 20 };

      fireEvent.mouseMove(plot, at);
      await act(() => new Promise(resolve => requestAnimationFrame(() => resolve(undefined))));
      fireEvent.mouseDown(plot, at);
      fireEvent.mouseUp(plot, at);
      fireEvent.click(plot, at);

      const zoomed = {
        from: new Date(firstBar + 12 * TWO_HOURS).toISOString(),
        to: new Date(firstBar + 13 * TWO_HOURS).toISOString(),
      };
      await waitFor(() => expect(onAggregate.mock.lastCall?.[0].timeRange).toEqual(zoomed));
      expect(onSpanQuery.mock.lastCall?.[0].timeRange).toEqual(zoomed);
      expect(screen.getByRole('button', { name: 'Reset time range' })).toBeTruthy();
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
