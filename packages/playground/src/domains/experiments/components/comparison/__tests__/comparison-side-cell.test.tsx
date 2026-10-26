import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ComparisonColumn } from '../build-comparison-rows';
import { ComparisonSideCell } from '../comparison-side-cell';
import { TestLinkProvider } from '@/test/link-provider';

const makeColumn = (overrides: Partial<ComparisonColumn>): ComparisonColumn => ({
  experimentId: 'exp-a',
  role: 'baseline',
  deltas: null,
  durationDeltaMs: null,
  present: true,
  targetType: null,
  output: null,
  metadata: null,
  comment: null,
  error: null,
  startedAt: null,
  completedAt: null,
  scores: [],
  ...overrides,
});

const renderCell = (column: ComparisonColumn, { showUsage = false }: { showUsage?: boolean } = {}) =>
  render(
    <TestLinkProvider>
      <ComparisonSideCell column={column} showUsage={showUsage} onShowTrace={() => {}} />
    </TestLinkProvider>,
  );

const outputRegion = () => screen.getByRole('region', { name: 'Output' });
const metricsRegion = () => screen.getByRole('region', { name: 'Metrics' });
const metricTerms = () =>
  within(metricsRegion())
    .getAllByRole('term')
    .map(term => term.textContent);
const metricValue = (label: string) =>
  within(metricsRegion())
    .getAllByRole('term')
    .find(term => term.textContent === label)?.nextElementSibling?.textContent;

const pricedTiming = {
  startedAt: '2026-01-01T00:00:00.000Z',
  completedAt: '2026-01-01T00:00:05.000Z',
  usage: { inputTokens: 120, outputTokens: 30, estimatedCost: 0.0015, costUnit: 'usd' },
};

describe('ComparisonSideCell', () => {
  afterEach(cleanup);

  describe('when the experiment targets an agent', () => {
    it('renders the agent text as markdown', () => {
      renderCell(makeColumn({ targetType: 'agent', output: { text: 'Try **banana nice cream**', toolCalls: [] } }));

      expect(within(outputRegion()).getByText('banana nice cream').tagName).toBe('STRONG');
      expect(outputRegion().querySelector('pre')).toBeNull();
    });

    it("shows the agent output's error instead of the output", () => {
      renderCell(makeColumn({ targetType: 'agent', output: { error: { message: 'Model timed out' } } }));

      expect(within(screen.getByRole('region', { name: 'Error' })).getByText('Model timed out')).toBeTruthy();
      expect(screen.queryByRole('region', { name: 'Output' })).toBeNull();
    });
  });

  describe('when the experiment targets a workflow', () => {
    it('renders the raw output as JSON', () => {
      renderCell(makeColumn({ targetType: 'workflow', output: { text: 'not an agent response' } }));

      const lines = Array.from(outputRegion().querySelectorAll('.cm-line'), line => line.textContent);
      expect(lines).toContain('  "text": "not an agent response"');
    });
  });

  describe('when usage is shown and the item is priced', () => {
    it('lists the cost first, then the duration and the tokens', () => {
      renderCell(makeColumn(pricedTiming), { showUsage: true });

      expect(metricTerms()).toEqual(['Cost', 'Duration', 'Tokens']);
      expect(within(metricsRegion()).getByText('$0.002')).toBeTruthy();
    });

    it('shows the input and output tokens together', () => {
      renderCell(makeColumn(pricedTiming), { showUsage: true });

      expect(within(metricsRegion()).getByText('150')).toBeTruthy();
    });
  });

  describe('when a contender uses more tokens than the baseline', () => {
    it('shows the extra tokens as a percentage regression', () => {
      renderCell(makeColumn({ ...pricedTiming, role: 'contender', tokenDelta: 50 }), { showUsage: true });

      const delta = within(metricsRegion()).getByText(/^\+50\.0%$/);
      expect(delta.className).toContain('text-destructive-foreground');
    });
  });

  describe('when a contender costs more than the baseline', () => {
    it('shows the extra cost as a percentage regression', () => {
      renderCell(makeColumn({ ...pricedTiming, role: 'contender', costDelta: 0.0005 }), { showUsage: true });

      const delta = within(metricsRegion()).getByText(/^\+50\.0%$/);
      expect(delta.className).toContain('text-destructive-foreground');
    });

    it('shows the absolute extra cost on focus', async () => {
      renderCell(makeColumn({ ...pricedTiming, role: 'contender', costDelta: 0.0005 }), { showUsage: true });

      fireEvent.focus(within(metricsRegion()).getByText(/^\+50\.0%$/));

      expect((await screen.findByRole('tooltip')).textContent).toBe('+$0.001');
    });
  });

  describe('when the baseline cost is zero', () => {
    it('shows the absolute extra cost', () => {
      renderCell(makeColumn({ ...pricedTiming, role: 'contender', costDelta: 0.0015 }), { showUsage: true });

      const delta = within(metricsRegion()).getByText(/^\+\$0\.002$/);
      expect(delta.className).toContain('text-destructive-foreground');
    });
  });

  describe('when usage is shown but the item has no usage', () => {
    it('shows a dash for the cost and the tokens', () => {
      renderCell(makeColumn({ ...pricedTiming, usage: undefined }), { showUsage: true });

      expect(metricTerms().slice(0, 3)).toEqual(['Cost', 'Duration', 'Tokens']);
      expect(within(metricsRegion()).getAllByText('-')).toHaveLength(2);
    });
  });

  describe('when usage is not shown', () => {
    it('leaves the cost and the tokens out of the metrics', () => {
      renderCell(makeColumn(pricedTiming));

      expect(metricTerms()).toEqual(['Duration']);
    });
  });

  describe('when the item has several scores', () => {
    const scored = {
      ...pricedTiming,
      scores: [
        { scorerId: 'accuracy', value: 0.5, reason: null },
        { scorerId: 'relevancy', value: 0.9, reason: null },
      ],
    };

    it('lists the average score after the duration, before the tokens and the scorers', () => {
      renderCell(makeColumn(scored), { showUsage: true });

      expect(metricTerms()).toEqual(['Cost', 'Duration', 'Avg score', 'Tokens', 'accuracy', 'relevancy']);
    });

    it('shows the average of the item scores', () => {
      renderCell(makeColumn(scored));

      expect(metricValue('Avg score')).toBe('0.70');
    });
  });

  describe('when a scorer returned no value', () => {
    it('averages the scores that have one', () => {
      renderCell(
        makeColumn({
          scores: [
            { scorerId: 'accuracy', value: null, reason: null },
            { scorerId: 'relevancy', value: 0.6, reason: null },
          ],
        }),
      );

      expect(metricValue('Avg score')).toBe('0.60');
    });
  });

  describe('when a contender averages a higher score than the baseline', () => {
    it('shows the gain as a percentage improvement', () => {
      renderCell(
        makeColumn({
          role: 'contender',
          averageScoreDelta: 0.2,
          scores: [{ scorerId: 'accuracy', value: 0.9, reason: null }],
        }),
      );

      const delta = within(metricsRegion()).getByText(/^\+28\.6%$/);
      expect(delta.className).toContain('text-success-indicator');
    });
  });

  describe('when the run recorded no trace', () => {
    it('shows no View trace button', () => {
      renderCell(makeColumn({ ...pricedTiming, traceId: undefined }));

      expect(screen.queryByRole('button', { name: 'View trace' })).toBeNull();
    });
  });

  describe('when every metric of the cell is hidden in the metrics picker', () => {
    beforeEach(() => {
      localStorage.setItem('mastra:experiments-compare:hidden-metrics', JSON.stringify(['duration', 'cost', 'tokens']));
    });
    afterEach(() => localStorage.clear());

    it('drops the Metrics section', () => {
      renderCell(makeColumn({ ...pricedTiming, traceId: 'trace-1' }), { showUsage: true });

      expect(screen.queryByRole('region', { name: 'Metrics' })).toBeNull();
    });

    it('keeps the View trace button', () => {
      renderCell(makeColumn({ ...pricedTiming, traceId: 'trace-1' }), { showUsage: true });

      expect(screen.getByRole('button', { name: 'View trace' })).toBeDefined();
    });
  });

  describe('when the item has no score', () => {
    it('leaves the average score out of the metrics', () => {
      renderCell(makeColumn(pricedTiming), { showUsage: true });

      expect(metricTerms()).not.toContain('Avg score');
    });
  });
});
