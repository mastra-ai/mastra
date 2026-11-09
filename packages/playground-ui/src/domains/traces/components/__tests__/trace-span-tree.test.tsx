// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatHierarchicalSpans } from '../format-hierarchical-spans';
import type { SpanRowContext } from '../span-rows';
import { TraceSpanTree } from '../trace-span-tree';
import { deepTraceFixture, nestedSpanFixture } from './fixtures/trace-data-panel-view';

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

describe('TraceSpanTree — connector lines', () => {
  const deepSpans = formatHierarchicalSpans(deepTraceFixture);

  function DeepHarness({ renderTrailing }: { renderTrailing?: (ctx: SpanRowContext) => React.ReactNode }) {
    const [expandedSpanIds, setExpandedSpanIds] = useState(['root', 'gen-1', 'tool-1', 'wf-1']);
    return (
      <TraceSpanTree
        hierarchicalSpans={deepSpans}
        onSpanClick={() => {}}
        expandedSpanIds={expandedSpanIds}
        setExpandedSpanIds={setExpandedSpanIds}
        renderTrailing={renderTrailing}
      />
    );
  }

  const guidesIn = (spanName: string) =>
    within(screen.getByLabelText(`View details for span ${spanName}`)).queryAllByTestId('span-tree-guide');

  it('keeps an ancestor level connected while that ancestor still has siblings below', () => {
    const guidesById: Record<string, boolean[]> = {};
    render(
      <DeepHarness
        renderTrailing={ctx => {
          guidesById[ctx.span.id] = ctx.guides;
          return null;
        }}
      />,
    );

    // root → [gen-1 → [tool-1 → [http-1], mem-1], wf-1 → [step-1, gen-2]]
    expect(guidesById).toEqual({
      root: [],
      'gen-1': [],
      'tool-1': [true],
      'http-1': [true, true],
      'mem-1': [true],
      'wf-1': [],
      'step-1': [false],
      'gen-2': [false],
    });

    // http-1 sits under gen-1 and tool-1, which both have siblings further down.
    expect(guidesIn('http fetch')).toHaveLength(2);
    expect(guidesIn('memory lookup')).toHaveLength(1);
    // wf-1 is the root's last child, so nothing continues past its subtree.
    expect(guidesIn('step normalize')).toHaveLength(0);
  });
});

describe('TraceSpanTree — trailing cell', () => {
  it('shows the span duration under each span name', () => {
    render(<Harness />);

    // Both fixture spans last exactly one second.
    expect(screen.getAllByText('1s')).toHaveLength(2);
    // The duration sits on its own line under the name, inside the same row.
    const root = screen.getByLabelText('View details for span agent run');
    expect(within(root).getByRole('button', { name: /agent run/ }).textContent).toBe('agent run');
    within(root).getByText('1s');
  });

  it('separates the span kind from its name with a chevron and drops the quotes', () => {
    const spans = formatHierarchicalSpans(nestedSpanFixture).map(span => ({
      ...span,
      name: "agent run: 'chef-agent'",
    }));
    render(<TraceSpanTree hierarchicalSpans={spans} onSpanClick={() => {}} />);

    const row = screen.getByLabelText("View details for span agent run: 'chef-agent'");
    expect(within(row).getByRole('button', { name: /chef-agent/ }).textContent).toBe('agent run›chef-agent');
  });

  it('renders a custom trailing cell with the row context', () => {
    const renderTrailing = vi.fn((ctx: SpanRowContext) => <span>{`${ctx.span.id}@${ctx.depth}`}</span>);
    render(<Harness renderTrailing={renderTrailing} />);

    screen.getByText('root@0');
    screen.getByText('child@1');
    // The duration line is kept alongside the custom trailing cell.
    expect(screen.getAllByText('1s')).toHaveLength(2);
  });
});
