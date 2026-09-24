// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatHierarchicalSpans } from '../format-hierarchical-spans';
import type { SpanRowContext } from '../span-rows';
import { TraceSpanTree } from '../trace-span-tree';
import { nestedSpanFixture } from './fixtures/trace-data-panel-view';

// jsdom has no layout, so it ships no scrollIntoView.
const scrollIntoView = vi.fn();
Element.prototype.scrollIntoView = scrollIntoView;

afterEach(() => {
  cleanup();
  scrollIntoView.mockClear();
});

const hierarchicalSpans = formatHierarchicalSpans(nestedSpanFixture);

// The tree reveals rows only once their ancestors expand, and expansion is owned by the
// caller, so the harness holds that state the way the trace panel and the thread view do.
function Harness({
  revealSpanId,
  renderTrailing,
}: {
  revealSpanId?: string;
  renderTrailing?: (ctx: SpanRowContext) => React.ReactNode;
}) {
  const [expandedSpanIds, setExpandedSpanIds] = useState<string[]>([]);
  return (
    <TraceSpanTree
      hierarchicalSpans={hierarchicalSpans}
      onSpanClick={() => {}}
      expandedSpanIds={expandedSpanIds}
      setExpandedSpanIds={setExpandedSpanIds}
      featuredSpanIds={['root', 'child']}
      revealSpanId={revealSpanId}
      renderTrailing={renderTrailing}
    />
  );
}

describe('TraceSpanTree — revealing a span', () => {
  it('scrolls the reveal span into view once its parent expands', () => {
    render(<Harness revealSpanId="child" />);

    // The child was not mounted at first render: the featured-ancestor effect expanded the root.
    const row = screen.getByLabelText('View details for span weather tool');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(row);
  });

  it('scrolls the new row when the reveal span changes', () => {
    const { rerender } = render(<Harness revealSpanId="child" />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(<Harness revealSpanId="root" />);

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView.mock.instances[1]).toBe(screen.getByLabelText('View details for span agent run'));
  });

  it('does not scroll when no reveal span is set', () => {
    render(<Harness />);

    screen.getByLabelText('View details for span weather tool');
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

describe('TraceSpanTree — trailing cell', () => {
  it('shows the span duration as seconds under each span name', () => {
    render(<Harness />);

    // Both fixture spans last exactly one second.
    const durations = screen.getAllByText(
      (_, el) => el?.textContent === '1.000\u00a0s' && el.tagName === 'SPAN' && el.children.length === 0,
    );
    expect(durations).toHaveLength(2);
    // The duration lives inside the row's name button, right after the name.
    const root = screen.getByLabelText('View details for span agent run');
    expect(within(root).getByRole('button', { name: /agent run/ }).textContent).toBe('agent run1.000\u00a0s');
  });

  it('renders a custom trailing cell with the row context', () => {
    const renderTrailing = vi.fn((ctx: SpanRowContext) => <span>{`${ctx.span.id}@${ctx.depth}`}</span>);
    render(<Harness renderTrailing={renderTrailing} />);

    screen.getByText('root@0');
    screen.getByText('child@1');
    // The duration line is kept alongside the custom trailing cell.
    expect(
      screen.getAllByText(
        (_, el) => el?.textContent === '1.000\u00a0s' && el.tagName === 'SPAN' && el.children.length === 0,
      ),
    ).toHaveLength(2);
  });
});
