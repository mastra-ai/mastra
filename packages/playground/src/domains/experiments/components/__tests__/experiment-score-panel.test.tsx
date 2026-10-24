import type { ClientScoreRowData } from '@mastra/client-js';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExperimentScorePanel } from '../experiment-score-panel';

// `hasJudge: false` marks it a code-based scorer so only the score section renders.
const score: ClientScoreRowData = {
  id: 'score-1',
  scorerId: 'accuracy',
  entityId: 'item-1',
  runId: 'exp-1',
  entity: {},
  source: 'TEST',
  score: 0.92,
  reason: 'Looks correct',
  traceId: undefined,
  scorer: { hasJudge: false },
  createdAt: '2026-08-25T10:00:00.000Z',
  updatedAt: null,
};

describe('ExperimentScorePanel', () => {
  afterEach(cleanup);

  it('shows the scorer id and score when expanded', () => {
    render(<ExperimentScorePanel open score={score} onClose={vi.fn()} />);

    expect(screen.getByText('accuracy')).toBeDefined();
    expect(screen.getByText(/Score: 0\.92/)).toBeDefined();
  });

  it('shows the categorical label next to the score when the scorer gave one', () => {
    render(<ExperimentScorePanel open score={{ ...score, label: 'exemplary' }} onClose={vi.fn()} />);

    expect(screen.getByText('Score: 0.92 · exemplary')).toBeDefined();
  });

  it('shows only the number when the scorer gave no label', () => {
    render(<ExperimentScorePanel open score={{ ...score, label: null }} onClose={vi.fn()} />);

    expect(screen.getByText('Score: 0.92')).toBeDefined();
  });
});
