// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReplayAggregates } from '../../hooks/use-replay-aggregates';
import { ExperimentReplaySummary } from '../experiment-replay-summary';

/** Matches what useReplayAggregates folds out of one callFlowResult. */
const aggregates: ReplayAggregates = {
  total: 1,
  fullyGrounded: 0,
  withMisses: 1,
  withUnconsumed: 1,
  withArgMismatches: 1,
  withFailedExpectations: 0,
  failedReplay: 0,
  emptyRecordings: 0,
  staleRecordings: 0,
  redactedPayloads: 0,
  callTotals: { total: 4, replayed: 2, replayedWithDrift: 1, mocked: 1, missed: 0, live: 1 },
  itemFlows: [
    {
      resultId: 'result-replay-3',
      itemId: 'item-5',
      outcomes: [
        { outcome: 'replayed' },
        { outcome: 'replayed', argsDiffered: true },
        { outcome: 'mocked' },
        { outcome: 'miss-passthrough' },
      ],
      hasError: false,
    },
  ],
};

describe('ExperimentReplaySummary', () => {
  afterEach(cleanup);

  it('renders the verdict, the flow graph, and its legend from call totals', () => {
    render(
      <ExperimentReplaySummary
        marker={{ onMiss: 'passthrough', matching: 'strict' }}
        experimentId="exp-replay-1"
        aggregates={aggregates}
        isLoading={false}
        experimentStatus="completed"
      />,
    );

    expect(
      screen.getByText('4 tool calls across 1 item — 2 replayed (1 with different args) · 1 mocked · 1 ran live'),
    ).toBeDefined();
    const graph = screen.getByTestId('replay-flow-graph');
    expect(within(graph).getByText('1 args differed')).toBeDefined();
    expect(within(graph).getByText('1 mocked')).toBeDefined();
    expect(within(graph).getByText('1 ran live')).toBeDefined();
    // matching policy stays visible in the header
    expect(screen.getByText('· matching: strict')).toBeDefined();
  });

  it('renders one clickable flow row per item and opens its result', () => {
    const onSelectResult = vi.fn();
    render(
      <ExperimentReplaySummary
        marker={{ onMiss: 'error' }}
        experimentId="exp-replay-1"
        aggregates={aggregates}
        isLoading={false}
        experimentStatus="completed"
        onSelectResult={onSelectResult}
      />,
    );

    const table = screen.getByTestId('replay-flow-table');
    // The row label carries the outcome counts — the glyphs are decorative.
    // Miss-passthrough gets its own bucket so it stays distinguishable from
    // a plain unmocked live call by screen readers.
    const row = within(table).getByRole('button', {
      name: 'Open result for item item-5 — 2 replayed, 1 mocked, 1 ran live on a miss',
    });
    expect(row.textContent).toContain('item-5');
    expect(row.textContent).toContain('✓✓Ⓜ⚡');

    fireEvent.click(row);
    expect(onSelectResult).toHaveBeenCalledWith('result-replay-3');
  });

  it('hides the glyphs from assistive tech and sets miss-passthrough apart beyond color', () => {
    render(
      <ExperimentReplaySummary
        marker={{ onMiss: 'passthrough' }}
        experimentId="exp-replay-1"
        aggregates={aggregates}
        isLoading={false}
        experimentStatus="completed"
      />,
    );

    const table = screen.getByTestId('replay-flow-table');
    const glyphs = [...table.querySelectorAll('[title]')];
    expect(glyphs).toHaveLength(4);
    for (const glyph of glyphs) {
      expect(glyph.getAttribute('aria-hidden')).toBe('true');
    }
    // Live and miss-passthrough share ⚡ — the passthrough one alone carries
    // the dotted underline and the passthrough title.
    const passthrough = glyphs.find(glyph => glyph.getAttribute('title')?.includes('passthrough'));
    expect(passthrough?.className).toContain('decoration-dotted');
    const others = glyphs.filter(glyph => glyph !== passthrough);
    for (const glyph of others) {
      expect(glyph.className).not.toContain('decoration-dotted');
    }
  });

  it('announces the capped window while the summary is partial', () => {
    render(
      <ExperimentReplaySummary
        marker={{ onMiss: 'error' }}
        experimentId="exp-replay-1"
        aggregates={{ ...aggregates, partial: true }}
        isLoading={false}
        experimentStatus="running"
      />,
    );

    expect(screen.getByText('Summary over the first 500 items — final after completion.')).toBeDefined();
  });

  it('renders no partial note once the summary covers everything', () => {
    render(
      <ExperimentReplaySummary
        marker={{ onMiss: 'error' }}
        experimentId="exp-replay-1"
        aggregates={aggregates}
        isLoading={false}
        experimentStatus="completed"
      />,
    );

    expect(screen.queryByText(/Summary over the first/)).toBeNull();
  });

  it('renders no graph or table when no report carries a call flow', () => {
    render(
      <ExperimentReplaySummary
        marker={{ onMiss: 'error' }}
        experimentId="exp-replay-1"
        aggregates={{
          ...aggregates,
          callTotals: { total: 0, replayed: 0, replayedWithDrift: 0, mocked: 0, missed: 0, live: 0 },
          itemFlows: [],
        }}
        isLoading={false}
        experimentStatus="completed"
      />,
    );

    expect(screen.queryByTestId('replay-flow-graph')).toBeNull();
    expect(screen.queryByTestId('replay-flow-table')).toBeNull();
  });
});
