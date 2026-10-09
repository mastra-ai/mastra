// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSpanTimingLayout } from '../../utils/span-timing';
import { formatHierarchicalSpans } from '../format-hierarchical-spans';
import { TraceSpanTimeline } from '../trace-span-timeline';
import { nestedSpanFixture } from './fixtures/trace-data-panel-view';

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
    expect(axis.textContent).toBe('0 ms250 ms500 ms750 ms1.000 s');
  });
});
