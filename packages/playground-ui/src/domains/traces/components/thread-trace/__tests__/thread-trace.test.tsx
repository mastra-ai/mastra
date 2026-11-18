// @vitest-environment jsdom
import { act, fireEvent, render as renderUI, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TraceNavigation } from '../../trace-navigation';
import { ThreadTrace, useThreadTrace, useThreadTraceRow } from '../index';
import type { ThreadTraceRootProps, ThreadTraceRowProps, ThreadTraceSelectedSpan } from '../index';
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

/** A host's own messages slot, driving the highlight through the row hook. */
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

type ThreadProps = Partial<ThreadTraceRootProps> & {
  rowProps?: (traceId: string) => Partial<ThreadTraceRowProps>;
};

/** A host filling the slots of each turn; rendered without any Mastra client or React Query provider. */
function Thread({ traceIds = TRACE_IDS, rowProps, ...props }: ThreadProps) {
  return (
    <ThreadTrace traceIds={traceIds} spanDetail={<ThreadTrace.SpanDetail span={spanADetail.span} />} {...props}>
      {traceIds.map((traceId, index) => (
        <ThreadTrace.Row
          key={traceId}
          traceId={traceId}
          label={`Turn ${index + 1}`}
          messages={<MessagesSlot />}
          feedback={<p>Feedback of {traceId}</p>}
          spans={<ThreadTrace.Spans spans={spansOf(traceId)} />}
          detailsHeader={<button type="button">Action {traceId}</button>}
          {...rowProps?.(traceId)}
        />
      ))}
      <RootStateProbe />
    </ThreadTrace>
  );
}

const renderThread = (props: ThreadProps = {}) => renderUI(<Thread {...props} />);

const getRow = (traceId: string) => {
  const row = document.querySelector<HTMLElement>(`[data-trace-id="${traceId}"]`);
  if (!row) throw new Error(`row ${traceId} not found`);
  return row;
};
const spanColumn = () => document.querySelector('[data-slot="thread-trace-span-panel"]');
const clickSpan = (traceId: string, name: string) => fireEvent.click(within(getRow(traceId)).getByText(name));

describe('ThreadTrace', () => {
  describe('when the host lays out its turns', () => {
    it('draws them in the given order and keeps the root className', async () => {
      const { container } = renderThread({ className: 'custom-root' });
      await screen.findAllByText('Chef agent run');

      const rows = [...container.querySelectorAll<HTMLElement>('[data-trace-id]')].map(row => row.dataset.traceId);
      expect(rows).toEqual(['trace-a', 'trace-b']);
      expect(container.firstElementChild?.className).toContain('custom-root');
    });

    it('draws every turn from the spans given to its spans slot', async () => {
      renderThread();

      expect(await within(getRow('trace-a')).findByText('Recipe lookup')).toBeTruthy();
      expect(within(getRow('trace-b')).getByText('Chef agent follow-up')).toBeTruthy();
    });

    it('names each turn by its label', async () => {
      renderThread();
      await screen.findAllByText('Chef agent run');

      expect(within(getRow('trace-b')).getByRole('group', { name: 'Turn 2' })).toBeTruthy();
    });

    it('renders what the host put in the details header', async () => {
      renderThread();

      expect(await screen.findByRole('button', { name: 'Action trace-a' })).toBeTruthy();
    });
  });

  describe('when the host fills only some view slots of a turn', () => {
    it('offers one tab per filled slot', async () => {
      renderThread({ rowProps: () => ({ feedback: undefined, scores: <p>Scores</p> }) });
      await screen.findAllByText('Chef agent run');

      expect(
        within(getRow('trace-a'))
          .getAllByRole('tab')
          .map(tab => tab.textContent),
      ).toEqual(['Messages', 'Scores']);
    });
  });

  describe('when the reader opens a turn’s Feedback tab', () => {
    it('swaps the messages for that turn’s feedback and leaves the span tree in place', async () => {
      renderThread();
      await screen.findAllByText('Chef agent run');

      fireEvent.click(within(getRow('trace-a')).getByRole('tab', { name: 'Feedback' }));

      expect(within(getRow('trace-a')).getByText('Feedback of trace-a')).toBeTruthy();
      expect(within(getRow('trace-a')).queryByText('Messages for trace-a')).toBeNull();
      expect(within(getRow('trace-a')).getByText('Chef agent run')).toBeTruthy();
      expect(within(getRow('trace-b')).getByText('Messages for trace-b')).toBeTruthy();
    });

    it('renders no feedback before its tab opens', async () => {
      renderThread();
      await screen.findAllByText('Chef agent run');

      expect(screen.queryByText(/Feedback of/)).toBeNull();
    });
  });

  describe('when the host controls a turn’s tab', () => {
    function ControlledTab({ onTabChange }: { onTabChange: (tab: string) => void }) {
      const [tab, setTab] = useState('feedback');
      return (
        <Thread
          traceIds={['trace-a']}
          rowProps={() => ({
            tab,
            onTabChange: next => {
              setTab(next);
              onTabChange(next);
            },
          })}
        />
      );
    }

    it('opens the tab it asks for', async () => {
      renderUI(<ControlledTab onTabChange={() => {}} />);

      expect(await screen.findByText('Feedback of trace-a')).toBeTruthy();
    });

    it('reports the tab the reader opens', async () => {
      const onTabChange = vi.fn<(tab: string) => void>();
      renderUI(<ControlledTab onTabChange={onTabChange} />);
      await screen.findByText('Feedback of trace-a');

      fireEvent.click(screen.getByRole('tab', { name: 'Messages' }));

      expect(onTabChange).toHaveBeenCalledWith('messages');
    });
  });

  describe('when the reader opens a span', () => {
    it('opens the span slot beside the conversation and marks its turn active', async () => {
      renderThread();
      await screen.findAllByText('Chef agent run');
      expect(spanColumn()).toBeNull();

      clickSpan('trace-a', 'Chef agent run');

      expect(await screen.findByRole('region', { name: 'Chef agent run' })).toBeTruthy();
      expect(screen.getAllByRole('separator')).toHaveLength(1);
      expect(getRow('trace-a').dataset.active).toBe('true');
      expect(getRow('trace-b').dataset.active).toBeUndefined();
      expect(screen.getByTestId('root-state').textContent).toBe('trace-a/span-a;none');
    });

    it('closes it when the same span is clicked again', async () => {
      renderThread();
      await screen.findAllByText('Chef agent run');
      clickSpan('trace-a', 'Chef agent run');
      await screen.findByRole('region', { name: 'Chef agent run' });

      clickSpan('trace-a', 'Chef agent run');

      await waitFor(() => expect(spanColumn()).toBeNull());
    });

    it('closes it from the span detail', async () => {
      renderThread();
      await screen.findAllByText('Chef agent run');
      clickSpan('trace-a', 'Chef agent run');

      fireEvent.click(await screen.findByRole('button', { name: 'Close span' }));

      await waitFor(() => expect(spanColumn()).toBeNull());
      expect(screen.queryByRole('separator')).toBeNull();
      expect(getRow('trace-a').dataset.active).toBeUndefined();
    });

    it('offers no previous/next span, since the span tree already navigates', async () => {
      renderThread();
      await screen.findAllByText('Chef agent run');
      clickSpan('trace-a', 'Chef agent run');
      await screen.findByRole('button', { name: 'Close span' });

      expect(screen.queryByRole('button', { name: 'Go to next span' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Go to previous span' })).toBeNull();
    });
  });

  describe('when the host leaves the span slot empty', () => {
    it('reports the opened span but draws no span column', async () => {
      const onSelectedSpanChange = vi.fn<(selected: ThreadTraceSelectedSpan | null) => void>();
      renderThread({ spanDetail: undefined, onSelectedSpanChange });
      await screen.findAllByText('Chef agent run');

      clickSpan('trace-a', 'Chef agent run');

      expect(onSelectedSpanChange).toHaveBeenCalledWith({ traceId: 'trace-a', spanId: 'span-a' });
      expect(spanColumn()).toBeNull();
    });
  });

  describe('when the host controls the selected span', () => {
    it('opens the span column on the span it selects', async () => {
      renderThread({ traceIds: ['trace-a'], selectedSpan: { traceId: 'trace-a', spanId: 'span-a' } });

      expect(await screen.findByRole('region', { name: 'Chef agent run' })).toBeTruthy();
      expect(getRow('trace-a').dataset.active).toBe('true');
    });

    it('asks the host to close the span instead of closing it itself', async () => {
      const onSelectedSpanChange = vi.fn();
      renderThread({
        traceIds: ['trace-a'],
        selectedSpan: { traceId: 'trace-a', spanId: 'span-a' },
        onSelectedSpanChange,
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Close span' }));

      expect(onSelectedSpanChange).toHaveBeenCalledWith(null);
      expect(screen.getByRole('region', { name: 'Chef agent run' })).toBeTruthy();
    });
  });

  describe('when the selected span record is still loading', () => {
    it('says so in the span column', async () => {
      renderThread({
        traceIds: ['trace-a'],
        selectedSpan: { traceId: 'trace-a', spanId: 'span-a' },
        spanDetail: <ThreadTrace.SpanDetail isLoading />,
      });

      expect(await screen.findByText('Loading span details...')).toBeTruthy();
    });
  });

  describe('when the host’s messages ask to highlight spans', () => {
    it('scopes the highlight to that turn', async () => {
      renderThread();
      await screen.findAllByText('Chef agent run');

      fireEvent.click(within(getRow('trace-a')).getByRole('button', { name: 'Highlight trace-a' }));

      expect(screen.getByTestId('root-state').textContent).toBe('none;trace-a');
    });

    it('clears the highlight once the opened span closes', async () => {
      renderThread();
      await screen.findAllByText('Chef agent run');
      fireEvent.click(within(getRow('trace-a')).getByRole('button', { name: 'Highlight trace-a' }));
      clickSpan('trace-a', 'Chef agent run');
      await screen.findByRole('region', { name: 'Chef agent run' });

      clickSpan('trace-a', 'Chef agent run');

      await waitFor(() => expect(screen.getByTestId('root-state').textContent).toBe('none;none'));
    });
  });

  describe('when another turn scrolls into view', () => {
    it('keeps every turn at full opacity', async () => {
      const { intersect } = stubIntersectionObserver();
      renderThread();
      await screen.findAllByText('Chef agent run');

      act(() => intersect(getRow('trace-b')));

      expect(getRow('trace-a').className).not.toMatch(/opacity/);
      expect(getRow('trace-b').className).not.toMatch(/opacity/);
    });
  });

  describe('when a turn’s span tree is taller than its messages', () => {
    it('clamps the tree to the messages height and reveals it with Expand', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 900 });
      renderThread({ traceIds: ['trace-a'] });
      await screen.findByText('Chef agent run');

      const timeline = await screen.findByTestId('trace-row-timeline');
      expect(timeline.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight).toBe('300px');
      fireEvent.click(screen.getByRole('button', { name: 'Expand' }));

      expect(timeline.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight).toBe('');
      expect(screen.getByRole('button', { name: 'Collapse' })).toBeTruthy();
    });

    it('holds Collapse back while a span of the turn is open', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 900 });
      renderThread({ traceIds: ['trace-a'] });
      await screen.findByText('Chef agent run');
      fireEvent.click(screen.getByRole('button', { name: 'Expand' }));

      clickSpan('trace-a', 'Chef agent run');
      await screen.findByRole('region', { name: 'Chef agent run' });

      expect(screen.queryByRole('button', { name: 'Collapse' })).toBeNull();
    });

    it('keeps clamping to the messages height while another view is showing', async () => {
      mockHeights({ 'trace-row-messages': 300, 'trace-row-timeline': 900 });
      renderThread({ traceIds: ['trace-a'] });
      await screen.findByText('Chef agent run');
      const timeline = await screen.findByTestId('trace-row-timeline');

      mockHeights({ 'trace-row-messages': 80, 'trace-row-timeline': 900 });
      fireEvent.click(screen.getByRole('tab', { name: 'Feedback' }));

      expect(timeline.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight).toBe('300px');
    });
  });

  describe('when the host composes a turn from the turn parts', () => {
    // No provider at all: the turn draws the spans it is given and navigates through the host's callbacks.
    const renderTurn = (row: Partial<ThreadTraceRowProps> = {}, navigation?: TraceNavigation) =>
      renderUI(
        <ThreadTrace traceIds={['trace-a']} navigation={navigation}>
          <ThreadTrace.Row
            traceId="trace-a"
            label="Turn 1"
            link={<ThreadTrace.TraceLink />}
            messages={<ThreadTrace.TurnMessages spans={spansOf('trace-a')} />}
            scores={<p>Host scores</p>}
            spans={<ThreadTrace.Spans spans={spansOf('trace-a')} />}
            {...row}
          />
          <RootStateProbe />
        </ThreadTrace>,
      );

    it('reconstructs the turn from the spans given to TurnMessages', async () => {
      renderTurn();

      expect(await within(getRow('trace-a')).findByText('cook pasta')).toBeTruthy();
    });

    it('highlights the spans behind a message in the same turn', async () => {
      renderTurn();
      await within(getRow('trace-a')).findByText('cook pasta');

      const [userMessageAction] = within(getRow('trace-a')).getAllByRole('button', { name: 'Highlight spans' });
      if (!userMessageAction) throw new Error('no highlight action');
      fireEvent.click(userMessageAction);

      expect(screen.getByTestId('root-state').textContent).toBe('none;trace-a');
    });

    it('opens the turn’s trace through onOpenTrace', async () => {
      const onOpenTrace = vi.fn();
      renderTurn({}, { onOpenTrace });

      fireEvent.click(await within(getRow('trace-a')).findByRole('button', { name: 'Go to trace' }));

      expect(onOpenTrace).toHaveBeenCalledWith('trace-a');
    });

    it('offers no Go to trace when the host does not navigate', async () => {
      renderTurn();

      await within(getRow('trace-a')).findByText('cook pasta');

      expect(within(getRow('trace-a')).queryByRole('button', { name: 'Go to trace' })).toBeNull();
    });
  });

  describe('when the thread is not ready to draw', () => {
    it('shows the loading skeleton', () => {
      renderUI(<ThreadTrace.Loading />);

      expect(screen.getByRole('status', { name: 'Loading thread' })).toBeTruthy();
    });

    it('says the thread has no traces', () => {
      renderUI(<ThreadTrace.Empty />);

      expect(screen.getByText('No traces found for this thread.')).toBeTruthy();
    });

    it('shows why the thread failed to load', () => {
      renderUI(<ThreadTrace.Error error={new Error('store unavailable')} />);

      expect(screen.getByText('Failed to load traces')).toBeTruthy();
    });
  });
});
