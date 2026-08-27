import type { ListScoresResponse } from '@mastra/core/evals';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SpanScoresList } from '../span-scores-list';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { renderWithProviders } from '@/test/render';

const makeScore = (id: string): ListScoresResponse['scores'][number] => ({
  id,
  scorerId: 'scorer-1',
  entityId: 'agent-1',
  runId: `run-${id}`,
  output: 'output',
  score: 0.75,
  scorer: { name: 'Scorer One' },
  source: 'LIVE',
  entity: { id: 'agent-1' },
  createdAt: new Date('2026-08-25T10:00:00.000Z'),
  updatedAt: new Date('2026-08-25T10:00:00.000Z'),
});

const scoresData: ListScoresResponse = {
  scores: [makeScore('score-1'), makeScore('score-2'), makeScore('score-3')],
  pagination: { total: 3, page: 0, perPage: 10, hasMore: false },
};

const renderList = (props?: Partial<Parameters<typeof SpanScoresList>[0]>) =>
  renderWithProviders(<SpanScoresList scoresData={scoresData} {...props} />);

describe('SpanScoresList keyboard navigation', () => {
  describe('when the list renders', () => {
    it('applies a roving tabindex across score rows', () => {
      renderList();
      const rows = interactiveRows();
      expect(rows).toHaveLength(3);
      expectRovingTabindex(rows);
    });
  });

  describe('when navigating with the keyboard', () => {
    it('moves focus with Arrow/Home/End keys', () => {
      renderList();
      expectArrowNavigation(interactiveRows());
    });
  });

  describe('when activating a focused row', () => {
    it('clicking a row still triggers onScoreSelect', () => {
      const onScoreSelect = vi.fn();
      renderList({ onScoreSelect });

      const rows = interactiveRows();
      fireEvent.focus(rows[0] as HTMLElement);
      fireEvent.keyDown(rows[0] as HTMLElement, { key: 'End' });
      fireEvent.click(rows[2] as HTMLElement);

      expect(onScoreSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'score-3' }));
    });
  });
});
