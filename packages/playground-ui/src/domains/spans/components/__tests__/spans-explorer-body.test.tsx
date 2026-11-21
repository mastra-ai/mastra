// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { spanQueryCapabilities, spanRowsPage } from '../../__tests__/fixtures/spans';
import { createSpanFilterBarFields } from '../../span-filters';
import type { SpansExplorerSpans } from '../../spans-explorer-data';
import { resolveSpansSupport } from '../../spans-explorer-support';
import type { SpanSelection } from '../span-detail-panel';
import { SpansExplorerBody } from '../spans-explorer-body';
import type { SpansExplorerPanelArgs } from '../spans-explorer-body';
import { useObservabilityListFilters } from '@/domains/observability/hooks/use-observability-list-filters';
import { SPAN_LIST_SORT_FIELDS } from '@/domains/observability/observability-list-url-state';
import { TRACE_COLUMN_CATALOGS } from '@/domains/traces/trace-list-columns';
import type { TraceColumnPreferences } from '@/domains/traces/trace-list-columns';
import { FILTER_BAR_TIME_RANGE_FIELD } from '@/ds/components/FilterBar/filter-bar-time-range';
import { useFixedChartSize } from '@/test/chart-size';
import { recordRequests } from '@/test/record-requests';

/*
 * The spans page body composed by an app that is not Studio, e.g. an MCP server app with its own
 * transport: no Mastra client, no React Query, no router, no provider at all. Every record comes from
 * the app, typed by `@mastra/client-js`; every action goes back to it through a callback. A part that
 * fetched or needed a Studio provider fails here.
 */

const SUPPORT = resolveSpansSupport({ data: spanQueryCapabilities, isLoading: false });
const FILTER_FIELDS = [
  FILTER_BAR_TIME_RANGE_FIELD,
  ...createSpanFilterBarFields({
    withContextFields: SUPPORT.withContextFields,
    withTimeToFirstChunk: SUPPORT.withTimeToFirstChunk,
    withTimeToFirstToken: SUPPORT.withTimeToFirstToken,
    withOutcomeFields: SUPPORT.withOutcomeFields,
    withModelFields: SUPPORT.withModelFields,
    entityNames: [],
    environments: [],
  }),
];

function appSpans(overrides: Partial<SpansExplorerSpans> = {}): SpansExplorerSpans {
  return {
    spans: spanRowsPage.spans,
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    isError: false,
    onLoadMore: vi.fn(),
    ...overrides,
  };
}

/** An app that keeps its own filters, columns and open span, and loads spans its own way. */
function AppSpansPage({
  spans,
  selection: initialSelection,
  onSelectionChange,
  renderPanel = () => null,
}: {
  spans: SpansExplorerSpans;
  selection?: SpanSelection;
  onSelectionChange?: (selection: SpanSelection | undefined) => void;
  renderPanel?: (args: SpansExplorerPanelArgs) => React.ReactNode;
}) {
  const filters = useObservabilityListFilters(undefined, {
    sortFields: SPAN_LIST_SORT_FIELDS,
    withTokenSearch: SUPPORT.withTokenSearch,
  });
  const [preferences, setPreferences] = useState<TraceColumnPreferences>(TRACE_COLUMN_CATALOGS.spans.defaults);
  const [selection, setSelection] = useState(initialSelection);

  return (
    <SpansExplorerBody
      support={SUPPORT}
      filters={filters}
      columns={{
        preferences,
        setPreferences,
        resetColumns: () => setPreferences(TRACE_COLUMN_CATALOGS.spans.defaults),
      }}
      spans={spans}
      filterFields={FILTER_FIELDS}
      selection={selection}
      onSelectionChange={next => {
        setSelection(next);
        onSelectionChange?.(next);
      }}
      renderPanel={renderPanel}
    />
  );
}

/** The end of the list is always in view, so the list asks for the next page as soon as it has one. */
class EndOfListInView implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds = [];
  constructor(private callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    const rect = target.getBoundingClientRect();
    this.callback(
      [
        {
          target,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: rect,
          intersectionRect: rect,
          rootBounds: null,
          time: 0,
        },
      ],
      this,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

describe('SpansExplorerBody composed by an app without Studio providers', () => {
  // jsdom has no layout: give the virtualized list a box so its rows render.
  useFixedChartSize(1200, 800);

  it('lists the spans the app loaded without sending a request', async () => {
    const requests = recordRequests();
    render(<AppSpansPage spans={appSpans()} />);

    expect(await screen.findByRole('button', { name: /agent run: weather/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /tool: get-weather/ })).toBeTruthy();
    expect(requests).toEqual([]);
  });

  it('hands the clicked span back to the app', async () => {
    const onSelectionChange = vi.fn();
    render(<AppSpansPage spans={appSpans()} onSelectionChange={onSelectionChange} />);

    fireEvent.click(await screen.findByRole('button', { name: /tool: get-weather/ }));

    expect(onSelectionChange).toHaveBeenCalledWith({ traceId: 'trace-1', spanId: 'span-2' });
  });

  it('closes the open span when it is clicked again', async () => {
    const onSelectionChange = vi.fn();
    render(
      <AppSpansPage
        spans={appSpans()}
        selection={{ traceId: 'trace-1', spanId: 'span-2' }}
        onSelectionChange={onSelectionChange}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /tool: get-weather/ }));

    expect(onSelectionChange).toHaveBeenCalledWith(undefined);
  });

  it("renders the app's panel with the open span and the loaded spans for navigation", async () => {
    const renderPanel = vi.fn((args: SpansExplorerPanelArgs) =>
      args.selection ? <aside>Open span {args.selection.spanId}</aside> : null,
    );
    render(
      <AppSpansPage
        spans={appSpans()}
        selection={{ traceId: 'trace-1', spanId: 'span-1' }}
        renderPanel={renderPanel}
      />,
    );

    expect(await screen.findByText('Open span span-1')).toBeTruthy();
    expect(renderPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        spans: [
          { traceId: 'trace-1', spanId: 'span-1' },
          { traceId: 'trace-1', spanId: 'span-2' },
        ],
      }),
    );
  });

  it("shows the app's load error instead of the list", async () => {
    render(<AppSpansPage spans={appSpans({ spans: [], isError: true, error: new Error('store is down') })} />);

    expect(await screen.findByText(/store is down/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /agent run: weather/ })).toBeNull();
  });

  describe('when the end of the list is in view', () => {
    beforeEach(() => vi.stubGlobal('IntersectionObserver', EndOfListInView));

    it('asks the app for the next page when it has one', async () => {
      const spans = appSpans({ hasNextPage: true });
      render(<AppSpansPage spans={spans} />);

      await waitFor(() => expect(spans.onLoadMore).toHaveBeenCalled());
    });

    it('asks for nothing when the app has no other page', async () => {
      const spans = appSpans();
      render(<AppSpansPage spans={spans} />);
      await screen.findByRole('button', { name: /agent run: weather/ });

      expect(spans.onLoadMore).not.toHaveBeenCalled();
    });

    it('asks for nothing while the next page is loading', async () => {
      const spans = appSpans({ hasNextPage: true, isFetchingNextPage: true });
      render(<AppSpansPage spans={spans} />);
      await screen.findByRole('button', { name: /agent run: weather/ });

      expect(spans.onLoadMore).not.toHaveBeenCalled();
    });
  });
});
