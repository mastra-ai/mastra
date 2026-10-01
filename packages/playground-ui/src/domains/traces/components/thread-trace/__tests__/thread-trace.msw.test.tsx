// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render as renderUI, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThreadTrace, useThreadTrace, useThreadTraceRow } from '../index';
import { spanADetail, traceASpans, traceBSpans } from './fixtures/thread-trace';
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

// jsdom does not implement scrollIntoView, which the anchor row relies on.
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

const renderView = ({ traceIds = TRACE_IDS, className }: { traceIds?: string[]; className?: string } = {}) =>
  renderUI(
    <ThreadTrace traceIds={traceIds} className={className}>
      <ThreadTrace.List data-testid="thread-trace-list">
        {traceIds.map((traceId, index) => (
          <ThreadTrace.Row key={traceId} traceId={traceId}>
            <ThreadTrace.Divider label={`Turn ${index + 1}`}>
              <ThreadTrace.TabList>
                <ThreadTrace.Tab value="messages">Messages</ThreadTrace.Tab>
                <ThreadTrace.Tab value="extra">Extra</ThreadTrace.Tab>
              </ThreadTrace.TabList>
            </ThreadTrace.Divider>
            <ThreadTrace.RowBody>
              <ThreadTrace.Messages>
                <ThreadTrace.TabContent value="messages">
                  <MessagesSlot />
                </ThreadTrace.TabContent>
                <ThreadTrace.TabContent value="extra">Extra content {traceId}</ThreadTrace.TabContent>
              </ThreadTrace.Messages>
              <ThreadTrace.Details data-testid={`details-${traceId}`}>
                <ThreadTrace.DetailsHeader>
                  <ThreadTrace.DetailsActions>
                    <ThreadTrace.SpansToggle />
                    <button type="button">Action {traceId}</button>
                  </ThreadTrace.DetailsActions>
                </ThreadTrace.DetailsHeader>
                <ThreadTrace.Spans />
              </ThreadTrace.Details>
            </ThreadTrace.RowBody>
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
    });
  });

  describe('row emphasis', () => {
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
      expect(container.firstElementChild?.className).toContain('grid-cols-[minmax(0,2fr)_minmax(0,0fr)]');
      expect(container.firstElementChild?.className).toContain('transition-[grid-template-columns]');
      expect(screen.getByTestId('span-panel').childElementCount).toBe(0);

      fireEvent.click(screen.getByText('Chef agent run'));

      await waitFor(() => expect(screen.getByTestId('span-panel').childElementCount).toBeGreaterThan(0));
      expect(container.firstElementChild?.className).toContain('grid-cols-[minmax(0,2fr)_minmax(0,1fr)]');
      expect(getRow('trace-a').dataset.active).toBe('true');
      expect(getRow('trace-b').dataset.active).toBeUndefined();
      expect(screen.getByTestId('root-state').textContent).toBe('trace-a/span-a;none');

      // No close button on the span panel: re-clicking the selected span toggles it off.
      fireEvent.click(screen.getByText('Chef agent run'));
      await waitFor(() => expect(screen.getByTestId('span-panel').childElementCount).toBe(0));
      expect(container.firstElementChild?.className).toContain('grid-cols-[minmax(0,2fr)_minmax(0,0fr)]');
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

  describe('messages column tabs', () => {
    it('swaps the messages column body per row and leaves the span tree in place', async () => {
      renderView();
      await screen.findByText('Chef agent run');
      const rowA = getRow('trace-a');
      const rowB = getRow('trace-b');

      fireEvent.click(within(rowA).getByRole('tab', { name: 'Extra' }));

      expect(within(rowA).getByText('Extra content trace-a')).toBeTruthy();
      expect(within(rowA).queryByRole('button', { name: 'Highlight trace-a' })).toBeNull();
      expect(within(rowA).getByText('Chef agent run')).toBeTruthy();
      expect(within(rowB).queryByText('Extra content trace-b')).toBeNull();
      expect(within(rowB).getByRole('button', { name: 'Highlight trace-b' })).toBeTruthy();
    });
  });

  describe('highlighting spans from the messages slot', () => {
    it('scopes the highlight to that row', async () => {
      renderView();
      await screen.findByText('Chef agent run');
      const rowA = getRow('trace-a');

      fireEvent.click(within(rowA).getByRole('button', { name: 'Highlight trace-a' }));

      expect(screen.getByTestId('root-state').textContent).toBe('none;trace-a');
      await within(rowA).findByText('Recipe lookup');
      // Closing the panel clears the highlight, so opening and closing a span resets it.
      fireEvent.click(within(rowA).getByText('Chef agent run'));
      await waitFor(() => expect(screen.getByTestId('span-panel').childElementCount).toBeGreaterThan(0));
      fireEvent.click(within(rowA).getByText('Chef agent run'));
      await waitFor(() => expect(screen.getByTestId('root-state').textContent).toBe('none;none'));
    });
  });

  describe('details column', () => {
    it('announces each turn in a divider, drops the grid borders, renders the details as a card, and renders custom actions', async () => {
      renderView();
      await screen.findByText('Chef agent run');

      for (const [index, id] of ['trace-a', 'trace-b'].entries()) {
        const details = screen.getByTestId(`details-${id}`);
        const row = getRow(id);
        const divider = within(row).getByRole('group', { name: `Turn ${index + 1}` });
        expect(within(divider).getByRole('tab', { name: 'Messages' })).toBeTruthy();
        expect(row.className).not.toContain('border-b');
        expect(row.querySelector('[data-slot=thread-trace-messages]')?.className).not.toContain('border-r');
        expect(details.className).toContain('rounded-xl');
      }
      expect(screen.getByRole('button', { name: 'Action trace-a' })).toBeTruthy();
    });

    it('keeps clamping to the Messages view height while another view is showing', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 900 });
      renderView({ traceIds: ['trace-a'] });
      await screen.findByText('Chef agent run');

      const timeline = await screen.findByTestId('trace-row-timeline');
      expect(timeline.style.maxHeight).toBe('300px');

      mockHeights({ 'trace-row-messages': 80, 'trace-row-timeline': 900 });
      fireEvent.click(screen.getByRole('tab', { name: 'Extra' }));

      expect(screen.getByRole('tab', { name: 'Extra' }).getAttribute('aria-selected')).toBe('true');
      expect(timeline.style.maxHeight).toBe('300px');
      expect(getRow('trace-a').querySelector<HTMLElement>('[data-slot=thread-trace-messages]')?.style.minHeight).toBe(
        '300px',
      );
    });

    it('clamps a long timeline to the messages height and expands on Expand', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 900 });
      renderView({ traceIds: ['trace-a'] });
      await screen.findByText('Chef agent run');

      const timeline = await screen.findByTestId('trace-row-timeline');
      expect(timeline.style.maxHeight).toBe('300px');
      fireEvent.click(screen.getByRole('button', { name: 'Expand' }));

      expect(timeline.style.maxHeight).toBe('');
      expect(screen.getByRole('button', { name: 'Collapse' })).toBeTruthy();

      // Collapsing would hide the selected span, so Collapse waits until the panel closes.
      fireEvent.click(screen.getByText('Chef agent run'));
      await waitFor(() => expect(screen.getByTestId('span-panel').childElementCount).toBeGreaterThan(0));
      expect(screen.queryByRole('button', { name: 'Collapse' })).toBeNull();
      fireEvent.click(screen.getByText('Chef agent run'));
      await screen.findByRole('button', { name: 'Collapse' });

      fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
      expect(timeline.style.maxHeight).toBe('300px');
    });
  });
});
