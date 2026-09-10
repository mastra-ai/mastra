// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatHierarchicalSpans } from '../format-hierarchical-spans';
import { TraceTimeline } from '../trace-timeline';
import { nestedSpanFixture } from './fixtures/trace-data-panel-view';

// jsdom has no layout, so it ships no scrollIntoView.
const scrollIntoView = vi.fn();
Element.prototype.scrollIntoView = scrollIntoView;

afterEach(() => {
  cleanup();
  scrollIntoView.mockClear();
});

const hierarchicalSpans = formatHierarchicalSpans(nestedSpanFixture);

// The timeline reveals rows only once their ancestors expand, and expansion is owned by the
// caller, so the harness holds that state the way the trace panel and the thread view do.
function Harness({ revealSpanId }: { revealSpanId?: string }) {
  const [expandedSpanIds, setExpandedSpanIds] = useState<string[]>([]);
  return (
    <TraceTimeline
      hierarchicalSpans={hierarchicalSpans}
      onSpanClick={() => {}}
      expandedSpanIds={expandedSpanIds}
      setExpandedSpanIds={setExpandedSpanIds}
      featuredSpanIds={['root', 'child']}
      revealSpanId={revealSpanId}
    />
  );
}

describe('TraceTimeline — revealing a span', () => {
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
