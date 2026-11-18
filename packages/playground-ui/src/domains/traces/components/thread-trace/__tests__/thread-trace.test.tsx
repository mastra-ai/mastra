// @vitest-environment jsdom
import { act, fireEvent, render as renderUI, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThreadTrace, useThreadTrace, useThreadTraceRow } from '../index';
import { spanADetail, traceASpans, traceBSpans } from './fixtures/thread-trace';

const TRACE_IDS = ['trace-a', 'trace-b'];

/** Every span of each turn, as the host's `getTrace` returned them. */
const spansOf = (traceId: string) => (traceId === 'trace-b' ? traceBSpans : traceASpans).spans;

// jsdom does not implement scrollIntoView, which the anchor row relies on, nor ResizeObserver,
// which the resizable panel group relies on.
const scrollIntoView = vi.fn();
beforeAll(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  scrollIntoView.mockClear();
});

afterEach(() => {
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
                    <button type="button">Action {traceId}</button>
                  </ThreadTrace.DetailsActions>
                </ThreadTrace.DetailsHeader>
                <ThreadTrace.Spans spans={spansOf(traceId)} />
              </ThreadTrace.Details>
            </ThreadTrace.RowBody>
          </ThreadTrace.Row>
        ))}
      </ThreadTrace.List>
      <ThreadTrace.SpanPanel data-testid="span-panel">
        <ThreadTrace.SpanDetail span={spanADetail.span} />
      </ThreadTrace.SpanPanel>
      <RootStateProbe />
    </ThreadTrace>,
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
      expect(screen.getByTestId('thread-trace-list')).toBeTruthy();
    });
  });

  describe('when the spans come from the props', () => {
    // Rendered without any Mastra client or React Query provider: a part that fetched would throw.
    it('draws every turn from them alone', async () => {
      renderView();

      expect(await within(getRow('trace-a')).findByText('Recipe lookup')).toBeTruthy();
      expect(within(getRow('trace-b')).getByText('Chef agent follow-up')).toBeTruthy();
    });
  });

  describe('when the host controls the selected span', () => {
    it('opens the side panel on the span it selects', async () => {
      renderUI(
        <ThreadTrace traceIds={['trace-a']} selectedSpan={{ traceId: 'trace-a', spanId: 'span-a' }}>
          <ThreadTrace.List>
            <ThreadTrace.Row traceId="trace-a">
              <ThreadTrace.RowBody>
                <ThreadTrace.Details>
                  <ThreadTrace.Spans spans={spansOf('trace-a')} />
                </ThreadTrace.Details>
              </ThreadTrace.RowBody>
            </ThreadTrace.Row>
          </ThreadTrace.List>
          <ThreadTrace.SpanPanel>
            <ThreadTrace.SpanDetail span={spanADetail.span} />
          </ThreadTrace.SpanPanel>
        </ThreadTrace>,
      );

      expect(await screen.findByRole('region', { name: 'Chef agent run' })).toBeTruthy();
      expect(getRow('trace-a').dataset.active).toBe('true');
    });

    it('asks the host to close the span instead of closing it itself', async () => {
      const onSelectedSpanChange = vi.fn();
      renderUI(
        <ThreadTrace
          traceIds={['trace-a']}
          selectedSpan={{ traceId: 'trace-a', spanId: 'span-a' }}
          onSelectedSpanChange={onSelectedSpanChange}
        >
          <ThreadTrace.List>
            <ThreadTrace.Row traceId="trace-a">
              <ThreadTrace.RowBody>
                <ThreadTrace.Details>
                  <ThreadTrace.Spans spans={spansOf('trace-a')} />
                </ThreadTrace.Details>
              </ThreadTrace.RowBody>
            </ThreadTrace.Row>
          </ThreadTrace.List>
          <ThreadTrace.SpanPanel>
            <ThreadTrace.SpanDetail span={spanADetail.span} />
          </ThreadTrace.SpanPanel>
        </ThreadTrace>,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Close span' }));

      expect(onSelectedSpanChange).toHaveBeenCalledWith(null);
      expect(screen.getByRole('region', { name: 'Chef agent run' })).toBeTruthy();
    });
  });

  describe('when the selected span record is still loading', () => {
    it('says so in the side panel', async () => {
      renderUI(
        <ThreadTrace traceIds={['trace-a']} selectedSpan={{ traceId: 'trace-a', spanId: 'span-a' }}>
          <ThreadTrace.List>
            <ThreadTrace.Row traceId="trace-a">
              <ThreadTrace.RowBody>
                <ThreadTrace.Details>
                  <ThreadTrace.Spans spans={spansOf('trace-a')} />
                </ThreadTrace.Details>
              </ThreadTrace.RowBody>
            </ThreadTrace.Row>
          </ThreadTrace.List>
          <ThreadTrace.SpanPanel>
            <ThreadTrace.SpanDetail isLoading />
          </ThreadTrace.SpanPanel>
        </ThreadTrace>,
      );

      expect(await screen.findByText('Loading span details...')).toBeTruthy();
    });
  });

  describe('row emphasis', () => {
    it('keeps every row at full opacity, whichever is in view', async () => {
      const { intersect } = stubIntersectionObserver();
      renderView();
      await screen.findByText('Chef agent run');

      act(() => intersect(getRow('trace-b')));
      expect(getRow('trace-a').className).not.toMatch(/opacity/);
      expect(getRow('trace-b').className).not.toMatch(/opacity/);
    });
  });

  describe('selecting a span', () => {
    it('opens the side panel for that row, marks the row active, and closes back', async () => {
      renderView();
      await screen.findByText('Chef agent run');
      expect(screen.queryByTestId('span-panel')).toBeNull();
      expect(screen.queryByRole('separator')).toBeNull();

      fireEvent.click(within(getRow('trace-a')).getByText('Chef agent run'));

      await waitFor(() => expect(screen.getByTestId('span-panel').childElementCount).toBeGreaterThan(0));
      // The span column opens behind a resize handle.
      expect(screen.getAllByRole('separator')).toHaveLength(1);
      expect(getRow('trace-a').dataset.active).toBe('true');
      expect(getRow('trace-b').dataset.active).toBeUndefined();
      expect(screen.getByTestId('root-state').textContent).toBe('trace-a/span-a;none');

      // Re-clicking the selected span toggles it off...
      fireEvent.click(within(getRow('trace-a')).getByText('Chef agent run'));
      await waitFor(() => expect(screen.queryByTestId('span-panel')).toBeNull());

      // ...and so does the panel's close button.
      fireEvent.click(within(getRow('trace-a')).getByText('Chef agent run'));
      await waitFor(() => expect(screen.getByTestId('span-panel').childElementCount).toBeGreaterThan(0));
      fireEvent.click(screen.getByRole('button', { name: 'Close span' }));
      await waitFor(() => expect(screen.queryByTestId('span-panel')).toBeNull());
      expect(screen.queryByRole('separator')).toBeNull();
      expect(getRow('trace-a').dataset.active).toBeUndefined();
    });

    it('has no prev/next buttons, since the span tree already navigates', async () => {
      renderView();
      await screen.findByText('Recipe lookup');
      fireEvent.click(within(getRow('trace-a')).getByText('Chef agent run'));
      await screen.findByRole('button', { name: 'Close span' });

      expect(screen.queryByRole('button', { name: 'Go to next span' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Go to previous span' })).toBeNull();
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
      expect(timeline.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight).toBe('300px');

      mockHeights({ 'trace-row-messages': 80, 'trace-row-timeline': 900 });
      fireEvent.click(screen.getByRole('tab', { name: 'Extra' }));

      expect(screen.getByRole('tab', { name: 'Extra' }).getAttribute('aria-selected')).toBe('true');
      expect(timeline.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight).toBe('300px');
      expect(getRow('trace-a').querySelector<HTMLElement>('[data-slot=thread-trace-messages]')?.style.minHeight).toBe(
        '300px',
      );
    });

    it('clamps a long timeline to the messages height and expands on Expand', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 900 });
      renderView({ traceIds: ['trace-a'] });
      await screen.findByText('Chef agent run');

      const timeline = await screen.findByTestId('trace-row-timeline');
      expect(timeline.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight).toBe('300px');
      fireEvent.click(screen.getByRole('button', { name: 'Expand' }));

      expect(timeline.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight).toBe('');
      expect(screen.getByRole('button', { name: 'Collapse' })).toBeTruthy();

      // Collapsing would hide the selected span, so Collapse waits until the panel closes.
      fireEvent.click(within(getRow('trace-a')).getByText('Chef agent run'));
      await waitFor(() => expect(screen.getByTestId('span-panel').childElementCount).toBeGreaterThan(0));
      expect(screen.queryByRole('button', { name: 'Collapse' })).toBeNull();
      fireEvent.click(within(getRow('trace-a')).getByText('Chef agent run'));
      await screen.findByRole('button', { name: 'Collapse' });

      fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
      expect(timeline.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight).toBe('300px');
    });
  });
});
