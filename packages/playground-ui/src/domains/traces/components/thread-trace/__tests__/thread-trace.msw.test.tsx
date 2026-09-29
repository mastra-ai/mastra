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
  const { openTraceId, selected, highlight } = useThreadTrace();
  return (
    <output data-testid="root-state">
      {openTraceId ?? 'none'};{selected ? `${selected.traceId}/${selected.spanId}` : 'none'};
      {highlight ? highlight.traceId : 'none'}
    </output>
  );
}

const renderView = ({
  anchorTraceId,
  traceIds = TRACE_IDS,
  className,
  onLayoutChange,
}: {
  anchorTraceId?: string;
  traceIds?: string[];
  className?: string;
  onLayoutChange?: (layout: string) => void;
} = {}) =>
  renderUI(
    <ThreadTrace
      traceIds={traceIds}
      anchorTraceId={anchorTraceId}
      className={className}
      onLayoutChange={onLayoutChange}
    >
      <ThreadTrace.List data-testid="thread-trace-list">
        <ThreadTrace.Rail turns={railTurns} />
        <ThreadTrace.LoadMoreSentinel data-testid="sentinel" />
        {traceIds.map(traceId => (
          <ThreadTrace.Row key={traceId} traceId={traceId}>
            <ThreadTrace.TurnDivider />
            <MessagesSlot />
          </ThreadTrace.Row>
        ))}
      </ThreadTrace.List>
      <ThreadTrace.TracePanel actions={traceId => <button type="button">Action {traceId}</button>}>
        {traceId => (
          <ThreadTrace.Tabs>
            <ThreadTrace.TabsHeader>
              <ThreadTrace.TabList>
                <ThreadTrace.Tab value="spans">Spans</ThreadTrace.Tab>
                <ThreadTrace.Tab value="extra">Extra</ThreadTrace.Tab>
              </ThreadTrace.TabList>
            </ThreadTrace.TabsHeader>
            <ThreadTrace.TabContent value="spans">
              <ThreadTrace.Spans traceId={traceId} />
            </ThreadTrace.TabContent>
            <ThreadTrace.TabContent value="extra">Extra content {traceId}</ThreadTrace.TabContent>
          </ThreadTrace.Tabs>
        )}
      </ThreadTrace.TracePanel>
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
const rootClass = (container: HTMLElement) => container.firstElementChild?.className ?? '';
const tracePanel = () => {
  const panel = document.querySelector<HTMLElement>('[data-slot=thread-trace-trace-panel]');
  if (!panel) throw new Error('trace panel not mounted');
  return panel;
};
const state = () => screen.getByTestId('root-state').textContent?.replace(/\s/g, '');

describe('ThreadTrace', () => {
  describe('conversation layout', () => {
    it('shows only the conversation with one "Turn N" divider per row', async () => {
      const { container } = renderView({ className: 'custom-root' });
      await screen.findByText('Messages for trace-a');

      const rows = [...container.querySelectorAll<HTMLElement>('[data-trace-id]')].map(row => row.dataset.traceId);
      expect(rows).toEqual(['trace-a', 'trace-b']);
      expect(within(getRow('trace-a')).getByText('Turn 1')).toBeTruthy();
      expect(within(getRow('trace-b')).getByText('Turn 2')).toBeTruthy();
      expect(rootClass(container)).toContain('custom-root');
      expect(rootClass(container)).toContain('grid-cols-[minmax(0,1fr)_0fr_0fr]');
      expect(rootClass(container)).toContain('transition-[grid-template-columns]');
      expect(tracePanel().childElementCount).toBe(0);
      expect(screen.getByTestId('span-panel').childElementCount).toBe(0);
      expect(screen.queryByText('Chef agent run')).toBeNull();
    });

    it('scrolls the anchor row into view once without opening its trace', async () => {
      renderView({ anchorTraceId: 'trace-b' });
      await screen.findByText('Messages for trace-b');

      expect(scrollIntoView.mock.instances[0]).toBe(getRow('trace-b'));
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(getRow('trace-b').dataset.active).toBeUndefined();
      expect(screen.queryByText('Chef agent follow-up')).toBeNull();
    });
  });

  describe('rail', () => {
    it('scrolls the matching row into view on click', async () => {
      renderView();
      await screen.findByText('Messages for trace-a');

      fireEvent.click(screen.getByRole('button', { name: 'Jump to Turn trace-b' }));
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.instances[0]).toBe(getRow('trace-b'));
    });
  });

  describe('trace column', () => {
    it('opens from the turn divider, swaps between turns, and closes', async () => {
      const onLayoutChange = vi.fn();
      const { container } = renderView({ onLayoutChange });
      await screen.findByText('Messages for trace-a');

      fireEvent.click(screen.getByRole('button', { name: 'Show trace for turn 1' }));
      await within(tracePanel()).findByText('Chef agent run');
      expect(rootClass(container)).toContain('grid-cols-[minmax(0,1fr)_1fr_0fr]');
      expect(getRow('trace-a').dataset.active).toBe('true');
      expect(screen.getByRole('button', { name: 'Hide trace for turn 1' }).getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('button', { name: 'Action trace-a' })).toBeTruthy();
      expect(onLayoutChange).toHaveBeenLastCalledWith('trace');

      fireEvent.click(screen.getByRole('button', { name: 'Show trace for turn 2' }));
      await within(tracePanel()).findByText('Chef agent follow-up');
      expect(within(tracePanel()).queryByText('Chef agent run')).toBeNull();
      expect(getRow('trace-a').dataset.active).toBeUndefined();

      fireEvent.click(within(tracePanel()).getByRole('button', { name: 'Hide trace' }));
      await waitFor(() => expect(tracePanel().childElementCount).toBe(0));
      expect(rootClass(container)).toContain('grid-cols-[minmax(0,1fr)_0fr_0fr]');
      expect(onLayoutChange).toHaveBeenLastCalledWith('conversation');
    });

    it('swaps the column body through its tabs', async () => {
      renderView();
      await screen.findByText('Messages for trace-a');
      fireEvent.click(screen.getByRole('button', { name: 'Show trace for turn 1' }));
      await within(tracePanel()).findByText('Chef agent run');

      fireEvent.click(screen.getByRole('tab', { name: 'Extra' }));
      expect(screen.getByText('Extra content trace-a')).toBeTruthy();
      expect(screen.queryByText('Chef agent run')).toBeNull();
    });

    it('opens with the highlighted spans when a message part is clicked', async () => {
      renderView();
      await screen.findByText('Messages for trace-a');

      fireEvent.click(screen.getByRole('button', { name: 'Highlight trace-a' }));
      expect(state()).toBe('trace-a;none;trace-a');
      await within(tracePanel()).findByText('Recipe lookup');
    });
  });

  describe('span column', () => {
    it('opens a third column, closes on re-click, and closes when another turn opens', async () => {
      const onLayoutChange = vi.fn();
      const { container } = renderView({ onLayoutChange });
      await screen.findByText('Messages for trace-a');
      fireEvent.click(screen.getByRole('button', { name: 'Show trace for turn 1' }));
      fireEvent.click(await within(tracePanel()).findByText('Chef agent run'));

      await waitFor(() => expect(screen.getByTestId('span-panel').childElementCount).toBeGreaterThan(0));
      expect(rootClass(container)).toContain('xl:grid-cols-[minmax(0,1fr)_1fr_1fr]');
      expect(state()).toBe('trace-a;trace-a/span-a;none');
      expect(onLayoutChange).toHaveBeenLastCalledWith('span');

      fireEvent.click(within(tracePanel()).getByText('Chef agent run'));
      await waitFor(() => expect(screen.getByTestId('span-panel').childElementCount).toBe(0));
      expect(rootClass(container)).toContain('grid-cols-[minmax(0,1fr)_1fr_0fr]');

      fireEvent.click(within(tracePanel()).getByText('Chef agent run'));
      await waitFor(() => expect(state()).toBe('trace-a;trace-a/span-a;none'));
      fireEvent.click(screen.getByRole('button', { name: 'Show trace for turn 2' }));
      await waitFor(() => expect(state()).toBe('trace-b;none;none'));
      expect(screen.getByTestId('span-panel').childElementCount).toBe(0);
    });

    it('navigates prev/next within the same trace', async () => {
      renderView();
      await screen.findByText('Messages for trace-a');
      fireEvent.click(screen.getByRole('button', { name: 'Show trace for turn 1' }));
      fireEvent.click(await within(tracePanel()).findByText('Chef agent run'));
      await screen.findByRole('button', { name: 'Go to next span' });

      fireEvent.click(screen.getByRole('button', { name: 'Go to next span' }));
      await waitFor(() => expect(state()).toBe('trace-a;trace-a/span-a-tool;none'));
      fireEvent.click(screen.getByRole('button', { name: 'Go to previous span' }));
      await waitFor(() => expect(state()).toBe('trace-a;trace-a/span-a;none'));
    });
  });
});
