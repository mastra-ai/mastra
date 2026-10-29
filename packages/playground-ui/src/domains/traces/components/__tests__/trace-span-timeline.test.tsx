// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTraceTimeCursorStore } from '../../hooks/use-trace-time-cursor';
import { getSpanTimingLayout } from '../../utils/span-timing';
import { formatHierarchicalSpans } from '../format-hierarchical-spans';
import { TraceSpanTimeline } from '../trace-span-timeline';
import { TraceTimeCursorProvider } from '../trace-time-cursor-provider';
import { nestedSpanFixture } from './fixtures/trace-data-panel-view';
import { formatDuration } from '@/utils/duration';

const scrollIntoView = vi.fn();
Element.prototype.scrollIntoView = scrollIntoView;

afterEach(() => {
  cleanup();
  scrollIntoView.mockClear();
});

// The child starts 250ms into the 1s root so its bar sits away from the origin.
const fixture = nestedSpanFixture.map(span =>
  span.spanId === 'child'
    ? { ...span, startedAt: new Date('2026-06-01T10:00:00.250Z'), endedAt: new Date('2026-06-01T10:00:00.750Z') }
    : span,
);
const hierarchicalSpans = formatHierarchicalSpans(fixture);

function Harness({
  initialExpanded = [],
  onSpanClick = () => {},
  revealSpanId,
  featuredSpanIds,
}: {
  initialExpanded?: string[];
  onSpanClick?: (id: string) => void;
  revealSpanId?: string;
  featuredSpanIds?: string[];
}) {
  const [expandedSpanIds, setExpandedSpanIds] = useState<string[]>(initialExpanded);
  return (
    <TraceSpanTimeline
      hierarchicalSpans={hierarchicalSpans}
      onSpanClick={onSpanClick}
      expandedSpanIds={expandedSpanIds}
      setExpandedSpanIds={setExpandedSpanIds}
      revealSpanId={revealSpanId}
      featuredSpanIds={featuredSpanIds}
    />
  );
}

const rows = () => screen.getAllByLabelText(/^View details for span/);

describe('TraceSpanTimeline', () => {
  it('lists rows depth-first and only mounts children of expanded spans', () => {
    const { rerender } = render(<Harness />);
    expect(rows().map(r => r.getAttribute('aria-label'))).toEqual(['View details for span agent run']);

    rerender(<Harness initialExpanded={['root']} />);
    // Same component instance, state unchanged: still collapsed.
    expect(rows()).toHaveLength(1);

    cleanup();
    render(<Harness initialExpanded={['root']} />);
    expect(rows().map(r => r.getAttribute('aria-label'))).toEqual([
      'View details for span agent run',
      'View details for span weather tool',
    ]);
  });

  it('selects a span when its name is clicked', () => {
    const onSpanClick = vi.fn();
    render(<Harness initialExpanded={['root']} onSpanClick={onSpanClick} />);

    const row = screen.getByLabelText('View details for span weather tool');
    fireEvent.click(within(row).getByRole('button'));

    expect(onSpanClick).toHaveBeenCalledWith('child');
  });

  it('selects a span when anywhere on its row is clicked, except the expand toggle', () => {
    const onSpanClick = vi.fn();
    render(<Harness initialExpanded={['root']} onSpanClick={onSpanClick} />);

    const row = screen.getByLabelText('View details for span agent run');
    fireEvent.click(row);
    expect(onSpanClick).toHaveBeenCalledTimes(1);
    expect(onSpanClick).toHaveBeenCalledWith('root');

    fireEvent.click(within(row).getByRole('button', { name: 'Collapse children (1)' }));
    expect(onSpanClick).toHaveBeenCalledTimes(1);
  });

  it('toggles children with the single chevron at the end of the row', () => {
    render(<Harness />);
    expect(rows()).toHaveLength(1);

    const root = screen.getByLabelText('View details for span agent run');
    // Only one expansion control per row: the chevron follows the span name.
    expect(within(root).getAllByRole('button')).toHaveLength(2);
    expect(within(root).getAllByRole('button')[1]?.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(within(root).getByRole('button', { name: 'Expand children (1)' }));
    expect(rows()).toHaveLength(2);
    expect(within(root).getByRole('button', { name: 'Collapse children (1)' }).getAttribute('aria-expanded')).toBe(
      'true',
    );

    // Leaf rows have no chevron.
    const leaf = screen.getByLabelText('View details for span weather tool');
    expect(within(leaf).getAllByRole('button')).toHaveLength(1);

    fireEvent.click(within(root).getByRole('button', { name: 'Collapse children (1)' }));
    expect(rows()).toHaveLength(1);
  });

  it('positions each bar on the shared trace axis', () => {
    render(<Harness initialExpanded={['root']} />);
    const root = hierarchicalSpans[0];
    const child = root?.spans?.[0];
    if (!root || !child) throw new Error('fixture must have a root with one child');
    const layout = getSpanTimingLayout(child, root.latency, root.startTime);
    expect(layout).toEqual({ startShiftMs: 250, leftPercent: 25, widthPercent: 50 });

    const [rootBar, childBar] = screen.getAllByTestId('span-timeline-bar');
    expect([rootBar?.style.left, rootBar?.style.width]).toEqual(['0%', '100%']);
    expect([childBar?.style.left, childBar?.style.width]).toEqual([
      `${layout.leftPercent}%`,
      `${layout.widthPercent}%`,
    ]);

    // The duration is printed right where the bar ends.
    const childRow = screen.getByLabelText(`View details for span ${child.name}`);
    const duration = within(childRow).getByText(formatDuration(child.latency));
    expect(duration.style.left).toBe(`${layout.leftPercent + layout.widthPercent}%`);
  });

  it('scrolls the reveal span into view once its parent expands', () => {
    render(<Harness revealSpanId="child" featuredSpanIds={['root', 'child']} />);

    const row = screen.getByLabelText('View details for span weather tool');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(row);
  });

  it('labels the time axis from zero to the trace duration', () => {
    render(<Harness />);
    const axis = screen.getByLabelText('Trace time axis');
    expect(axis.textContent).toBe('0 ms250 ms500 ms750 ms1.00 s');
  });

  describe('with a time cursor', () => {
    const traceStart = Date.parse('2026-06-01T10:00:00.000Z');

    const renderWithCursor = (props: Parameters<typeof Harness>[0] = {}) => {
      const store = createTraceTimeCursorStore();
      render(
        <TraceTimeCursorProvider store={store}>
          <Harness initialExpanded={['root']} {...props} />
        </TraceTimeCursorProvider>,
      );
      return store;
    };

    it('scrolls to the lowest span the cursor crosses, only when that span changes', () => {
      const store = renderWithCursor();
      const scrolledTo = () => scrollIntoView.mock.instances.map(el => (el as Element).getAttribute('aria-label'));
      expect(scrollIntoView).not.toHaveBeenCalled();

      act(() => store.set(traceStart + 100));
      expect(scrolledTo()).toEqual(['View details for span agent run']);

      act(() => store.set(traceStart + 500));
      act(() => store.set(traceStart + 600));
      expect(scrolledTo()).toEqual(['View details for span agent run', 'View details for span weather tool']);

      act(() => store.set(traceStart + 900));
      expect(scrolledTo()).toEqual([
        'View details for span agent run',
        'View details for span weather tool',
        'View details for span agent run',
      ]);
      expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest', behavior: 'smooth' });
    });

    it('shows the whole trace until the cursor is set', () => {
      renderWithCursor();

      expect(rows()).toHaveLength(2);
      expect(screen.getByTestId('timeline-time-cursor').style.left).toBe('100%');
      expect(screen.getByRole('slider', { name: 'Trace time cursor' }).getAttribute('aria-valuetext')).toBe(
        'Full trace',
      );
    });

    it('hides spans that have not started yet at the cursor', () => {
      const store = renderWithCursor();

      act(() => store.set(traceStart + 100));

      expect(rows().map(r => r.getAttribute('aria-label'))).toEqual(['View details for span agent run']);
      expect(screen.getByTestId('timeline-time-cursor').style.left).toBe('10%');
    });

    it('draws running spans up to the cursor with their elapsed time', () => {
      const store = renderWithCursor();

      act(() => store.set(traceStart + 500));

      const [rootBar, childBar] = screen.getAllByTestId('span-timeline-bar');
      expect([rootBar?.style.left, rootBar?.style.width]).toEqual(['0%', '50%']);
      expect([childBar?.style.left, childBar?.style.width]).toEqual(['25%', '25%']);
      const childRow = screen.getByLabelText('View details for span weather tool');
      expect(within(childRow).getByLabelText('Running')).not.toBeNull();
      expect(within(childRow).getByText(formatDuration(250))).not.toBeNull();
    });

    it('draws spans that ended before the cursor in full', () => {
      const store = renderWithCursor();

      act(() => store.set(traceStart + 900));

      const childRow = screen.getByLabelText('View details for span weather tool');
      expect(within(childRow).queryByLabelText('Running')).toBeNull();
      expect(screen.getAllByTestId('span-timeline-bar')[1]?.style.width).toBe('50%');
    });

    it('steps between span starts and ends with the keyboard, and Escape shows the full trace again', () => {
      const store = renderWithCursor();
      const slider = screen.getByRole('slider', { name: 'Trace time cursor' });

      fireEvent.keyDown(slider, { key: 'Home' });
      expect(store.get()).toBe(traceStart);
      expect(rows()).toHaveLength(1);

      const steps: (string | null)[] = [];
      for (let i = 0; i < 3; i++) {
        fireEvent.keyDown(slider, { key: 'ArrowRight' });
        steps.push(slider.getAttribute('aria-valuenow'));
      }
      expect(steps).toEqual(['250', '750', '1000']);
      expect(rows()).toHaveLength(2);

      fireEvent.keyDown(slider, { key: 'ArrowLeft' });
      expect(slider.getAttribute('aria-valuenow')).toBe('750');

      fireEvent.keyDown(slider, { key: 'Escape' });
      expect(store.get()).toBeNull();
      expect(screen.getByTestId('timeline-time-cursor').style.left).toBe('100%');
    });

    // jsdom has no layout: give the track 1000px and the 16px-wide playhead its center on `centerX`.
    const layOut = (centerX: number) => {
      const track = screen.getByLabelText('Trace time axis').firstElementChild as HTMLElement;
      vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 24));
      const playhead = screen.getByTestId('timeline-time-cursor');
      vi.spyOn(playhead, 'getBoundingClientRect').mockReturnValue(new DOMRect(centerX - 8, 0, 16, 400));
      playhead.hasPointerCapture = vi.fn(() => true);
      return playhead;
    };

    it('drags the playhead from anywhere along it, without jumping on press', async () => {
      const store = renderWithCursor();
      act(() => store.set(traceStart + 500));
      const playhead = layOut(500);

      // Pressed 3px left of the line: the cursor stays where it is.
      fireEvent.pointerDown(playhead, { button: 0, pointerId: 1, clientX: 497 });
      expect(store.get()).toBe(traceStart + 500);

      fireEvent.pointerMove(playhead, { pointerId: 1, clientX: 197 });
      await waitFor(() => expect(store.get()).toBe(traceStart + 200));
      expect(rows()).toHaveLength(1);
    });

    it('can be grabbed while showing the full trace', async () => {
      const store = renderWithCursor();
      const playhead = layOut(1000);

      fireEvent.pointerDown(playhead, { button: 0, pointerId: 1, clientX: 1000 });
      expect(store.get()).toBe(traceStart + 1000);

      fireEvent.pointerMove(playhead, { pointerId: 1, clientX: 100 });
      await waitFor(() => expect(store.get()).toBe(traceStart + 100));
      expect(rows()).toHaveLength(1);
    });

    it('still selects a span when its row is clicked while the cursor is set', () => {
      const onSpanClick = vi.fn();
      const store = renderWithCursor({ onSpanClick });
      act(() => store.set(traceStart + 500));

      fireEvent.click(screen.getByLabelText('View details for span weather tool'));

      expect(onSpanClick).toHaveBeenCalledWith('child');
    });
  });
});
