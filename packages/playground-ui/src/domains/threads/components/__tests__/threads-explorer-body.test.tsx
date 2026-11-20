// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyThreadRows, threadQueryCapabilities, threadRowsPage } from '../../__tests__/fixtures/threads';
import { createThreadFilterBarFields } from '../../thread-filters';
import { resolveThreadsSupport } from '../../threads-explorer-data';
import type { ThreadsExplorerThreads } from '../../threads-explorer-data';
import { ThreadsExplorerBody } from '../threads-explorer-body';
import type { ThreadsExplorerPanelArgs } from '../threads-explorer-body';
import { useObservabilityListFilters } from '@/domains/observability/hooks/use-observability-list-filters';
import { TRACE_COLUMN_CATALOGS } from '@/domains/traces/trace-list-columns';
import type { TraceColumnPreferences } from '@/domains/traces/trace-list-columns';
import { FILTER_BAR_TIME_RANGE_FIELD } from '@/ds/components/FilterBar/filter-bar-time-range';
import { useFixedChartSize } from '@/test/chart-size';
import { recordRequests } from '@/test/record-requests';

/*
 * The threads page body composed by an app that is not Studio, e.g. an MCP server app with its own
 * transport: no Mastra client, no React Query, no router, no provider at all. Every record comes from
 * the app, typed by `@mastra/client-js`; every action goes back to it through a callback. A part that
 * fetched or needed a Studio provider fails here.
 */

const SUPPORT = resolveThreadsSupport({ data: threadQueryCapabilities, isLoading: false });
const FILTER_FIELDS = [
  FILTER_BAR_TIME_RANGE_FIELD,
  ...createThreadFilterBarFields({
    withTimeToFirstChunk: SUPPORT.withTimeToFirstChunk,
    withTimeToFirstToken: SUPPORT.withTimeToFirstToken,
    entityNames: [],
    environments: [],
  }),
];

function appThreads(overrides: Partial<ThreadsExplorerThreads> = {}): ThreadsExplorerThreads {
  return {
    threads: threadRowsPage.threads,
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    isError: false,
    onLoadMore: vi.fn(),
    ...overrides,
  };
}

/** An app that keeps its own filters, columns and open thread, and loads threads its own way. */
function AppThreadsPage({
  threads,
  selectedThreadId,
  onSelectedThreadChange = () => {},
  renderPanel = () => null,
}: {
  threads: ThreadsExplorerThreads;
  selectedThreadId?: string;
  onSelectedThreadChange?: (threadId: string | undefined) => void;
  renderPanel?: (args: ThreadsExplorerPanelArgs) => ReactNode;
}) {
  const filters = useObservabilityListFilters();
  const [preferences, setPreferences] = useState<TraceColumnPreferences>(TRACE_COLUMN_CATALOGS.threads.defaults);

  return (
    <ThreadsExplorerBody
      support={SUPPORT}
      filters={filters}
      columns={{
        preferences,
        setPreferences,
        resetColumns: () => setPreferences(TRACE_COLUMN_CATALOGS.threads.defaults),
      }}
      threads={threads}
      filterFields={FILTER_FIELDS}
      selectedThreadId={selectedThreadId}
      onSelectedThreadChange={onSelectedThreadChange}
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

describe('ThreadsExplorerBody composed by an app without Studio providers', () => {
  // jsdom has no layout: give the virtualized list a box so its rows render.
  useFixedChartSize(1200, 800);

  it('lists the threads the app loaded without sending a request', async () => {
    const requests = recordRequests();
    render(<AppThreadsPage threads={appThreads()} />);

    expect(await screen.findByRole('button', { name: /Weather Agent/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Support Agent/ })).toBeTruthy();
    expect(requests).toEqual([]);
  });

  it('hands the clicked thread back to the app', async () => {
    const onSelectedThreadChange = vi.fn();
    render(<AppThreadsPage threads={appThreads()} onSelectedThreadChange={onSelectedThreadChange} />);

    fireEvent.click(await screen.findByRole('button', { name: /Support Agent/ }));

    expect(onSelectedThreadChange).toHaveBeenCalledWith('thread-2');
  });

  it("renders the open thread in the app's drawer and closes it through the app", async () => {
    const onSelectedThreadChange = vi.fn();
    render(
      <AppThreadsPage
        threads={appThreads()}
        selectedThreadId="thread-1"
        onSelectedThreadChange={onSelectedThreadChange}
        renderPanel={({ threadId, onClose }) =>
          threadId ? (
            <aside>
              Open thread {threadId}
              <button onClick={onClose}>Close drawer</button>
            </aside>
          ) : null
        }
      />,
    );

    expect(await screen.findByText('Open thread thread-1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }));

    expect(onSelectedThreadChange).toHaveBeenCalledWith(undefined);
  });

  it('shows the empty state when the app found no threads in an unfiltered window', async () => {
    render(<AppThreadsPage threads={appThreads({ threads: emptyThreadRows.threads })} />);

    expect(await screen.findByText(/^No threads for/)).toBeTruthy();
  });

  it("shows the app's load error instead of the list", async () => {
    render(<AppThreadsPage threads={appThreads({ threads: [], isError: true, error: new Error('store is down') })} />);

    expect(await screen.findByText(/store is down/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Weather Agent/ })).toBeNull();
  });

  describe('when the end of the list is in view', () => {
    beforeEach(() => vi.stubGlobal('IntersectionObserver', EndOfListInView));

    it('asks the app for the next page when it has one', async () => {
      const threads = appThreads({ hasNextPage: true });
      render(<AppThreadsPage threads={threads} />);

      await waitFor(() => expect(threads.onLoadMore).toHaveBeenCalled());
    });

    it('asks for nothing when the app has no other page', async () => {
      const threads = appThreads();
      render(<AppThreadsPage threads={threads} />);
      await screen.findByRole('button', { name: /Weather Agent/ });

      expect(threads.onLoadMore).not.toHaveBeenCalled();
    });

    it('asks for nothing while the next page is loading', async () => {
      const threads = appThreads({ hasNextPage: true, isFetchingNextPage: true });
      render(<AppThreadsPage threads={threads} />);
      await screen.findByRole('button', { name: /Weather Agent/ });

      expect(threads.onLoadMore).not.toHaveBeenCalled();
    });
  });
});
