// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render as renderUI, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThreadTrace, useThreadTrace, useThreadTraceRow } from '../index';
import { spanADetail, traceASpans, traceBSpans } from './fixtures/thread-trace';
import type { ThreadRailTurn } from '@/ds/components/ThreadRail';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const TRACE_IDS = ['trace-a', 'trace-b'];

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

// jsdom does not implement scrollIntoView, which the rail and the anchor row rely on.
const scrollIntoView = vi.fn();
beforeAll(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  scrollIntoView.mockClear();
  server.use(
    http.get(`${BASE_URL}/api/observability/traces/:traceId/spans/:spanId`, () => HttpResponse.json(spanADetail)),
    http.get(`${BASE_URL}/api/observability/traces/:traceId`, ({ params }) =>
      HttpResponse.json(params.traceId === 'trace-b' ? traceBSpans : traceASpans),
    ),
  );
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// jsdom has no layout: mock heights per `data-testid` (e.g. messages column 300px, timeline 900px).
const mockHeights = (heights: Record<string, number>) => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const height = heights[this.closest<HTMLElement>('[data-testid]')?.dataset.testid ?? ''] ?? 0;
    return { height, width: 100, top: 0, left: 0, right: 100, bottom: height, x: 0, y: 0, toJSON: () => ({}) };
  });
};

// jsdom has no IntersectionObserver; `intersect` notifies whichever observers watch the element.
const stubIntersectionObserver = () => {
  type Callback = (entries: Array<Pick<IntersectionObserverEntry, 'target' | 'isIntersecting'>>) => void;
  const observers: Array<{ cb: Callback; targets: Element[] }> = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      targets: Element[] = [];
      constructor(cb: Callback) {
        observers.push({ cb, targets: this.targets });
      }
      observe = (el: Element) => this.targets.push(el);
      disconnect = vi.fn();
    },
  );
  const intersect = (target: Element) =>
    observers.filter(o => o.targets.includes(target)).forEach(o => o.cb([{ target, isIntersecting: true }]));
  return { intersect };
};

const railTurns: ThreadRailTurn[] = TRACE_IDS.map(traceId => ({
  key: traceId,
  messageId: traceId,
  prompt: `Turn ${traceId}`,
  files: [],
  hiddenFileCount: 0,
}));

/** A consumer-provided messages slot that drives highlighting through the row hook. */
function MessagesSlot() {
  const { traceId, highlightSpans } = useThreadTraceRow();
  return (
    <div>
      <span>Messages for {traceId}</span>
      <button type="button" onClick={() => highlightSpans(['span-a-tool'])}>
        Highlight {traceId}
      </button>
    </div>
  );
}

function RootStateProbe() {
  const { selected, highlight } = useThreadTrace();
  return (
    <output data-testid="root-state">
      {selected ? `${selected.traceId}/${selected.spanId}` : 'none'};{highlight ? highlight.traceId : 'none'}
    </output>
  );
}

const renderView = ({
  anchorTraceId,
  traceIds = TRACE_IDS,
  className,
}: { anchorTraceId?: string; traceIds?: string[]; className?: string } = {}) =>
  renderUI(
    <ThreadTrace traceIds={traceIds} anchorTraceId={anchorTraceId} className={className}>
      <ThreadTrace.List data-testid="thread-trace-list">
        <ThreadTrace.Rail turns={railTurns} />
        <ThreadTrace.LoadMoreSentinel data-testid="sentinel" />
        {traceIds.map((traceId, index) => (
          <ThreadTrace.Row key={traceId} traceId={traceId} isFirst={index === 0}>
            <ThreadTrace.Messages>
              <MessagesSlot />
            </ThreadTrace.Messages>
            <ThreadTrace.Details data-testid={`details-${traceId}`}>
              <ThreadTrace.DetailsHeader>
                <ThreadTrace.TabList>
                  <ThreadTrace.Tab value="spans">Spans</ThreadTrace.Tab>
                  <ThreadTrace.Tab value="extra">Extra</ThreadTrace.Tab>
                </ThreadTrace.TabList>
                <ThreadTrace.DetailsActions>
                  <button type="button">Action {traceId}</button>
                </ThreadTrace.DetailsActions>
              </ThreadTrace.DetailsHeader>
              <ThreadTrace.SpansTab />
              <ThreadTrace.TabContent value="extra">Extra content {traceId}</ThreadTrace.TabContent>
            </ThreadTrace.Details>
          </ThreadTrace.Row>
        ))}
      </ThreadTrace.List>
      <ThreadTrace.SpanPanel data-testid="span-panel" />
      <RootStateProbe />
    </ThreadTrace>,
    { wrapper: Wrapper },
  );

const getRow = (traceId: string) => {
  const row = document.querySelector<HTMLElement>(`[data-trace-id="${traceId}"]`);
  if (!row) throw new Error(`row ${traceId} not found`);
  return row;
};

describe('ThreadTrace', () => {
  describe('root and list', () => {
    it('renders rows in the given order and merges the root className', async () => {
      const { container } = renderView({ className: 'custom-root' });
      await screen.findByText('Chef agent run');

      const rows = [...container.querySelectorAll<HTMLElement>('[data-trace-id]')].map(row => row.dataset.traceId);
      expect(rows).toEqual(['trace-a', 'trace-b']);
      expect(container.firstElementChild?.className).toContain('custom-root');
      expect(container.firstElementChild?.className).toContain('grid');
      expect(screen.getByTestId('thread-trace-list')).toBeTruthy();
      expect(screen.getByTestId('sentinel')).toBeTruthy();
    });

    it('scrolls the anchor row into view once and starts it expanded', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 900 });
      renderView({ anchorTraceId: 'trace-b' });
      await screen.findByText('Chef agent follow-up');

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.instances[0]).toBe(getRow('trace-b'));
      // trace-b is expanded from the start so its timeline is not clamped; trace-a is.
      await screen.findByRole('button', { name: 'Show more' });
      expect(within(getRow('trace-a')).getByRole('button', { name: 'Show more' })).toBeTruthy();
      expect(within(getRow('trace-b')).queryByRole('button', { name: 'Show more' })).toBeNull();
    });
  });

  describe('rail', () => {
    it('shows one stop per turn and scrolls the matching row into view on click', async () => {
      renderView();
      await screen.findByText('Chef agent run');

      fireEvent.click(screen.getByRole('button', { name: 'Jump to Turn trace-b' }));
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.instances[0]).toBe(getRow('trace-b'));
    });

    it('emphasises the first row in view and dims the others', async () => {
      const { intersect } = stubIntersectionObserver();
      renderView();
      await screen.findByText('Chef agent run');

      expect(getRow('trace-a').className).toContain('opacity-50');
      expect(getRow('trace-b').className).toContain('opacity-50');

      act(() => intersect(getRow('trace-b')));
      expect(getRow('trace-b').className).toContain('opacity-100');
      expect(getRow('trace-a').className).toContain('opacity-50');
    });
  });

  describe('selecting a span', () => {
    it('opens the side panel for that row, marks the row active, and closes back', async () => {
      const { container } = renderView();
      await screen.findByText('Chef agent run');
      // The span cell stays mounted but collapsed so opening it animates the grid columns.
      expect(container.firstElementChild?.className).toContain('grid-cols-[minmax(0,1fr)_0%]');
      expect(container.firstElementChild?.className).toContain('transition-[grid-template-columns]');
      expect(screen.getByTestId('span-panel').childElementCount).toBe(0);

      fireEvent.click(screen.getByText('Chef agent run'));

      await waitFor(() => expect(screen.getByTestId('span-panel').childElementCount).toBeGreaterThan(0));
      expect(container.firstElementChild?.className).toContain('grid-cols-[minmax(0,1fr)_40%]');
      expect(getRow('trace-a').dataset.active).toBe('true');
      expect(getRow('trace-b').dataset.active).toBeUndefined();
      expect(screen.getByTestId('root-state').textContent).toBe('trace-a/span-a;none');

      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      await waitFor(() => expect(screen.getByTestId('span-panel').childElementCount).toBe(0));
      expect(container.firstElementChild?.className).toContain('grid-cols-[minmax(0,1fr)_0%]');
      expect(getRow('trace-a').dataset.active).toBeUndefined();
    });

    it('navigates prev/next within the same trace', async () => {
      renderView();
      await screen.findByText('Recipe lookup');
      fireEvent.click(screen.getByText('Chef agent run'));
      await screen.findByRole('button', { name: 'Go to next span' });

      fireEvent.click(screen.getByRole('button', { name: 'Go to next span' }));
      await waitFor(() => expect(screen.getByTestId('root-state').textContent).toBe('trace-a/span-a-tool;none'));
      fireEvent.click(screen.getByRole('button', { name: 'Go to previous span' }));
      await waitFor(() => expect(screen.getByTestId('root-state').textContent).toBe('trace-a/span-a;none'));
    });
  });

  describe('highlighting spans from the messages slot', () => {
    it('scopes the highlight to that row and brings the spans tab back', async () => {
      renderView();
      await screen.findByText('Chef agent run');
      const rowA = getRow('trace-a');

      fireEvent.click(within(rowA).getByRole('tab', { name: 'Extra' }));
      expect(within(rowA).getByText('Extra content trace-a')).toBeTruthy();

      fireEvent.click(within(rowA).getByRole('button', { name: 'Highlight trace-a' }));

      expect(screen.getByTestId('root-state').textContent).toBe('none;trace-a');
      expect(within(rowA).queryByText('Extra content trace-a')).toBeNull();
      await within(rowA).findByText('Recipe lookup');
      // Closing the panel clears the highlight, so opening and closing a span resets it.
      fireEvent.click(within(rowA).getByText('Chef agent run'));
      await screen.findByTestId('span-panel');
      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      await waitFor(() => expect(screen.getByTestId('root-state').textContent).toBe('none;none'));
    });
  });

  describe('details column', () => {
    it('gives only the first row the top border and renders custom actions', async () => {
      renderView();
      await screen.findByText('Chef agent run');

      expect(screen.getByTestId('details-trace-a').className).toContain('rounded-t-xl');
      expect(screen.getByTestId('details-trace-b').className).not.toContain('rounded-t-xl');
      expect(screen.getByRole('button', { name: 'Action trace-a' })).toBeTruthy();
    });

    it('clamps a long timeline to the messages height and expands on Show more', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 900 });
      renderView({ traceIds: ['trace-a'] });
      await screen.findByText('Chef agent run');

      const timeline = await screen.findByTestId('trace-row-timeline');
      expect(timeline.style.maxHeight).toBe('300px');
      fireEvent.click(screen.getByRole('button', { name: 'Show more' }));

      expect(timeline.style.maxHeight).toBe('');
      expect(screen.getByRole('button', { name: 'Show less' })).toBeTruthy();

      // Collapsing would hide the selected span, so Show less waits until the panel closes.
      fireEvent.click(screen.getByText('Chef agent run'));
      await screen.findByTestId('span-panel');
      expect(screen.queryByRole('button', { name: 'Show less' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      await screen.findByRole('button', { name: 'Show less' });

      fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
      expect(timeline.style.maxHeight).toBe('300px');
    });
  });
});
