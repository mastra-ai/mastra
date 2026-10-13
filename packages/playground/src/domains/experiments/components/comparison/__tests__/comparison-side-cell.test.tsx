import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
      <ComparisonSideCell column={column} showUsage={showUsage} />
    </TestLinkProvider>,
  );

const outputRegion = () => screen.getByRole('region', { name: 'Output' });
const metricsRegion = () => screen.getByRole('region', { name: 'Metrics' });
const metricTerms = () =>
  within(metricsRegion())
    .getAllByRole('term')
    .map(term => term.textContent);

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

      expect(outputRegion().querySelector('pre')?.textContent).toContain('"text": "not an agent response"');
    });
  });

  describe('when usage is shown and the item is priced', () => {
    it('lists the cost first, then the duration and the tokens', () => {
      renderCell(makeColumn(pricedTiming), { showUsage: true });

      expect(metricTerms()).toEqual(['Cost', 'Duration', 'Tokens']);
      expect(within(metricsRegion()).getByText('$0.0015')).toBeTruthy();
    });

    it('shows the input and output tokens together', () => {
      renderCell(makeColumn(pricedTiming), { showUsage: true });

      expect(within(metricsRegion()).getByText('150')).toBeTruthy();
    });
  });

  describe('when a contender uses more tokens than the baseline', () => {
    it('shows the extra tokens as a regression', () => {
      renderCell(makeColumn({ ...pricedTiming, role: 'contender', tokenDelta: 1200 }), { showUsage: true });

      const delta = within(metricsRegion()).getByText(/^\+1,200$/);
      expect(delta.className).toContain('text-destructive-foreground');
    });
  });

  describe('when a contender costs more than the baseline', () => {
    it('shows the extra cost as a regression', () => {
      renderCell(makeColumn({ ...pricedTiming, role: 'contender', costDelta: 0.0015 }), { showUsage: true });

      const delta = within(metricsRegion()).getByText(/^\+\$0\.0015$/);
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
});
