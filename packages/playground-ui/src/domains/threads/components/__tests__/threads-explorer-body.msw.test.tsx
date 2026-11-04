// @vitest-environment jsdom
import type { GetObservabilityCapabilitiesResponse, QueryTraceThreadsResult } from '@mastra/client-js';
import type { ThreadQueryArgs } from '@mastra/react/hooks/traces';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  discoveredEntityNames,
  discoveredEnvironments,
  emptyThreadRows,
  noStreamingTimingsThreadCapabilities,
  threadHeadPage,
  threadQueryCapabilities,
  threadRowsPage,
} from '../../__tests__/fixtures/threads';
import { ThreadsExplorerBody } from '../threads-explorer-body';
import { OBSERVABILITY_LIST_POLL_INTERVAL_MS } from '@/domains/observability/list-polling';
import { savedViewFromSearchParams } from '@/domains/observability/saved-view-state';
import { SavedViewsProvider } from '@/domains/observability/saved-views';
import type { SavedViewsSource } from '@/domains/observability/saved-views';
import { createInMemorySavedViewsSource } from '@/domains/observability/saved-views/__tests__/fixtures/in-memory-source';
import { useTraceColumnPreferences } from '@/domains/traces/hooks/use-trace-column-preferences';
import { useFixedChartSize } from '@/test/chart-size';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';
import { SearchParamsHost } from '@/test/search-params-host';

const THREADS_QUERY_URL = `${TEST_BASE_URL}/api/observability/threads/query`;

const setHandlers = (
  threads: QueryTraceThreadsResult,
  capabilities: GetObservabilityCapabilitiesResponse = threadQueryCapabilities,
) =>
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(capabilities)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/entity-names`, () =>
      HttpResponse.json(discoveredEntityNames),
    ),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () =>
      HttpResponse.json(discoveredEnvironments),
    ),
    http.post(THREADS_QUERY_URL, () => HttpResponse.json(threads)),
  );

// Rendered with no router: the body only talks to its host through props.
const renderBody = () => {
  const onSelectedThreadChange = vi.fn<(threadId: string | undefined) => void>();
  const { unmount } = renderWithProviders(
    <ThreadsExplorerBody
      selectedThreadId={undefined}
      onSelectedThreadChange={onSelectedThreadChange}
      onOpenScore={() => {}}
    />,
  );
  return { onSelectedThreadChange, unmount };
};

/**
 * The body inside a stand-in router whose URL starts as `initial`, under a saved views store when
 * one is given; returns each thread query sent.
 */
const renderBodyAtUrl = (initial: string, savedViews?: SavedViewsSource) => {
  const queries: ThreadQueryArgs[] = [];
  server.use(
    http.post(THREADS_QUERY_URL, async ({ request }) => {
      queries.push((await request.json()) as ThreadQueryArgs);
      return HttpResponse.json(threadRowsPage);
    }),
  );
  const body = (
    <SearchParamsHost initial={initial}>
      {urlState => (
        <ThreadsExplorerBody
          selectedThreadId={undefined}
          onSelectedThreadChange={() => {}}
          onOpenScore={() => {}}
          urlState={urlState}
        />
      )}
    </SearchParamsHost>
  );
  renderWithProviders(
    savedViews ? (
      <SavedViewsProvider source={savedViews} queryKeyScope={['test']}>
        {body}
      </SavedViewsProvider>
    ) : (
      body
    ),
  );
  return { queries };
};

/** The body next to the traces and spans column selections, which live in their own storage. */
function BodyWithOtherListsColumns() {
  const traces = useTraceColumnPreferences();
  const spans = useTraceColumnPreferences({ scope: 'spans' });
  return (
    <>
      <ThreadsExplorerBody selectedThreadId={undefined} onSelectedThreadChange={() => {}} onOpenScore={() => {}} />
      <output data-testid="traces-columns">{traces.preferences.visibleColumns.join(',')}</output>
      <output data-testid="spans-columns">{spans.preferences.visibleColumns.join(',')}</output>
    </>
  );
}

const turnOnStreamingColumns = async () => {
  const button = await screen.findByRole<HTMLButtonElement>('button', { name: 'Columns' });
  await waitFor(() => expect(button.disabled).toBe(false));
  fireEvent.click(button);
  fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Time to first chunk' }));
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Time to first token' }));
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
};

describe('ThreadsExplorerBody', () => {
  useFixedChartSize(1200, 800);
  // Base UI ScrollArea calls getAnimations once a ResizeObserver exists; jsdom has no Web Animations API.
  beforeAll(() => {
    Element.prototype.getAnimations ??= () => [];
  });

  describe('when the store returns thread rows', () => {
    it('lists each thread by its agent', async () => {
      setHandlers(threadRowsPage);

      renderBody();

      expect(await screen.findByText('Weather Agent')).toBeTruthy();
      expect(screen.getByText('Support Agent')).toBeTruthy();
    });

    it("shows each thread's message count", async () => {
      setHandlers(threadRowsPage);

      renderBody();

      const weatherRow = await screen.findByRole('button', { name: /Weather Agent/ });
      const supportRow = screen.getByRole('button', { name: /Support Agent/ });
      expect(within(weatherRow).getByText('2')).toBeTruthy();
      expect(within(supportRow).getByText('7')).toBeTruthy();

      fireEvent.focus(screen.getByRole('button', { name: 'Messages' }));
      expect(
        await screen.findByText(
          'Messages sent in this thread, counting the whole thread, not just the selected time range',
        ),
      ).toBeTruthy();
    });
  });

  describe('when the user turns on the time to first chunk and time to first token columns', () => {
    beforeEach(() => window.localStorage.clear());

    it('labels them TTFC and TTFT and shows how long each thread took to stream its first chunk and token', async () => {
      setHandlers(threadRowsPage);

      renderBody();
      await turnOnStreamingColumns();

      expect(await screen.findByText('TTFC')).toBeTruthy();
      expect(screen.getByText('TTFT')).toBeTruthy();
      const weatherRow = screen.getByRole('button', { name: /Weather Agent/ });
      expect(within(weatherRow).getByText('412ms')).toBeTruthy();
      expect(within(weatherRow).getByText('538ms')).toBeTruthy();
    });

    it('keeps the selection for the next visit, apart from the traces and spans lists', async () => {
      setHandlers(threadRowsPage);

      const { unmount } = renderWithProviders(<BodyWithOtherListsColumns />);
      await turnOnStreamingColumns();
      await screen.findByText('412ms');
      unmount();

      renderWithProviders(<BodyWithOtherListsColumns />);

      expect(await screen.findByText('538ms')).toBeTruthy();
      expect(screen.getByTestId('traces-columns').textContent).not.toContain('timeToFirst');
      expect(screen.getByTestId('spans-columns').textContent).not.toContain('timeToFirst');
    });
  });

  describe('when the stored columns include time to first chunk and token but the store records neither', () => {
    beforeEach(() => window.localStorage.clear());

    it('leaves both columns out of the list', async () => {
      setHandlers(threadRowsPage);
      const { unmount } = renderBody();
      await turnOnStreamingColumns();
      await screen.findByText('412ms');
      unmount();

      setHandlers(threadRowsPage, noStreamingTimingsThreadCapabilities);
      renderBody();

      expect(await screen.findByText('Weather Agent')).toBeTruthy();
      expect(screen.queryByText('TTFC')).toBeNull();
      expect(screen.queryByText('TTFT')).toBeNull();
      expect(screen.queryByText('412ms')).toBeNull();
    });
  });

  describe('when a thread row is clicked', () => {
    it('asks the host to open that thread', async () => {
      setHandlers(threadRowsPage);

      const { onSelectedThreadChange } = renderBody();
      fireEvent.click(await screen.findByText('Support Agent'));

      expect(onSelectedThreadChange).toHaveBeenCalledWith('thread-2');
    });
  });

  describe('when the thread query fails', () => {
    it('shows the error in place of the list', async () => {
      setHandlers(threadRowsPage);
      server.use(http.post(THREADS_QUERY_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

      renderBody();

      expect(await screen.findByText('Failed to load threads')).toBeTruthy();
    });
  });

  describe('when the window has no threads', () => {
    it('shows the empty state', async () => {
      setHandlers(emptyThreadRows);

      renderBody();

      expect(await screen.findByRole('heading', { name: 'No threads for the last 7 days' })).toBeTruthy();
    });
  });

  describe('when a thread starts while the page is open', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('appears in the list on the next poll', async () => {
      setHandlers(threadRowsPage);
      server.use(
        http.post(THREADS_QUERY_URL, async ({ request }) => {
          const body = (await request.json()) as { orderBy?: Array<{ field: string }> };
          return HttpResponse.json(body.orderBy?.[0]?.field === 'endedAt' ? threadHeadPage : threadRowsPage);
        }),
      );
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });

      renderBody();
      expect(await screen.findAllByText('Weather Agent')).toHaveLength(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(OBSERVABILITY_LIST_POLL_INTERVAL_MS);
      });

      await waitFor(() => expect(screen.getAllByText('Weather Agent')).toHaveLength(2));
    });
  });

  describe('when the URL filters on time to first chunk and time to first token', () => {
    const STREAMING_FILTERS =
      'filter.timeToFirstChunkMs=500&filter.timeToFirstChunkMs.op=lte&filter.timeToFirstTokenMs=800&filter.timeToFirstTokenMs.op=gt';
    const paths = (where: unknown) => JSON.stringify(where ?? null);

    it('sends both conditions when the store records both', async () => {
      setHandlers(threadRowsPage);

      const { queries } = renderBodyAtUrl(STREAMING_FILTERS);
      await screen.findByText('Weather Agent');

      await waitFor(() =>
        expect(queries.map(query => paths(query.where))).toContainEqual(
          expect.stringMatching(/"timeToFirstChunkMs".*"timeToFirstTokenMs"/),
        ),
      );
    });

    it('leaves both conditions out when the store does not record them', async () => {
      const onCapabilities = vi.fn();
      setHandlers(threadRowsPage, noStreamingTimingsThreadCapabilities);
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => {
          onCapabilities();
          return HttpResponse.json(noStreamingTimingsThreadCapabilities);
        }),
      );

      const { queries } = renderBodyAtUrl(STREAMING_FILTERS);
      await screen.findByText('Weather Agent');
      await waitFor(() => expect(onCapabilities).toHaveBeenCalled());

      for (const query of queries) {
        expect(paths(query.where)).not.toContain('timeToFirstChunkMs');
        expect(paths(query.where)).not.toContain('timeToFirstTokenMs');
      }
    });
  });

  describe('when the URL holds a filter, a sort and a time range', () => {
    it('queries threads with them', async () => {
      setHandlers(threadRowsPage);

      const { queries } = renderBodyAtUrl('filter.entityName=Support+Agent&sort=startedAt&dir=asc&datePreset=last-24h');
      await screen.findByText('Weather Agent');

      const [query] = queries;
      expect(JSON.stringify(query?.where)).toContain('"Support Agent"');
      expect(query?.orderBy).toEqual([{ field: 'startedAt', direction: 'asc' }]);
      const start = new Date(query?.timeRange?.traces?.from ?? NaN).getTime();
      expect(Date.now() - start).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(Date.now() - start).toBeLessThan(25 * 60 * 60 * 1000);
    });
  });

  describe('when the user sorts the list by start time', () => {
    it('writes the sort to the URL and keeps the other params', async () => {
      setHandlers(threadRowsPage);

      renderBodyAtUrl('threadId=thread-2&filter.entityName=Support+Agent');
      fireEvent.click(await screen.findByRole('button', { name: /^Start, sorted descending/ }));

      await waitFor(() =>
        expect(new URLSearchParams(screen.getByTestId('search-params').textContent ?? '')).toEqual(
          new URLSearchParams('threadId=thread-2&filter.entityName=Support+Agent&sort=startedAt&dir=asc'),
        ),
      );
    });
  });

  describe('when the user picks the last 30 days', () => {
    it('queries the wider window and writes it to the URL', async () => {
      setHandlers(threadRowsPage);

      const { queries } = renderBodyAtUrl('threadId=thread-2');
      await screen.findByText('Weather Agent');
      fireEvent.click(screen.getByRole('button', { name: /Last 7 days/ }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Last 30 days' }));

      await waitFor(() => {
        const from = new Date(queries.at(-1)?.timeRange?.traces?.from ?? NaN).getTime();
        expect(Math.round((Date.now() - from) / (24 * 60 * 60 * 1000))).toBe(30);
      });
      expect(screen.getByTestId('search-params').textContent).toBe('threadId=thread-2&datePreset=last-30d');
    });
  });

  describe('saved views', () => {
    const URL_BY_HAND = 'filter.entityName=Support+Agent&datePreset=last-24h&sort=startedAt&dir=asc';

    it('shows no saved views when the host does not store them', async () => {
      setHandlers(threadRowsPage);
      renderBodyAtUrl(URL_BY_HAND);
      await screen.findByText('Weather Agent');

      expect(screen.queryByLabelText(/^View: /)).toBeNull();
    });

    it('applying a view queries what the user gets by setting it by hand', async () => {
      setHandlers(threadRowsPage);
      const state = savedViewFromSearchParams('threads', new URLSearchParams(URL_BY_HAND));
      const source = createInMemorySavedViewsSource([{ name: 'Support', state }]);
      const { queries } = renderBodyAtUrl('', source);
      await screen.findByText('Weather Agent');

      fireEvent.click(await screen.findByLabelText(/^View: /));
      fireEvent.click(await screen.findByRole('option', { name: 'Support' }));

      await waitFor(() => expect(screen.getByTestId('search-params').textContent).toBe(URL_BY_HAND));
      await waitFor(() => expect(JSON.stringify(queries.at(-1)?.where)).toContain('"Support Agent"'));
    });
  });
});
