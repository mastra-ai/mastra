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

const renderCell = (column: ComparisonColumn) =>
  render(
    <TestLinkProvider>
      <ComparisonSideCell column={column} />
    </TestLinkProvider>,
  );

const outputRegion = () => screen.getByRole('region', { name: 'Output' });

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
});
