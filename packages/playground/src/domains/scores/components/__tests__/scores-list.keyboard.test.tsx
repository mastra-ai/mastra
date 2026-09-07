import type { ClientScoreRowData } from '@mastra/client-js';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ScoresList } from '../scores-list';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { renderWithProviders } from '@/test/render';

const makeScore = (id: string): ClientScoreRowData => ({
  id,
  scorerId: 'scorer-1',
  entityId: 'agent-1',
  runId: `run-${id}`,
  output: 'output',
  score: 0.9,
  scorer: { name: 'Scorer One' },
  source: 'LIVE',
  entity: { id: 'agent-1' },
  createdAt: '2026-08-25T10:00:00.000Z',
  updatedAt: '2026-08-25T10:00:00.000Z',
});

const scores = [makeScore('score-1'), makeScore('score-2'), makeScore('score-3')];

const renderList = (props?: Partial<Parameters<typeof ScoresList>[0]>) =>
  renderWithProviders(<ScoresList scores={scores} isLoading={false} {...props} />);

describe('ScoresList keyboard navigation', () => {
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
    it('clicking a row still triggers onScoreClick', () => {
      const onScoreClick = vi.fn();
      renderList({ onScoreClick });

      const rows = interactiveRows();
      fireEvent.focus(rows[0] as HTMLElement);
      fireEvent.keyDown(rows[0] as HTMLElement, { key: 'ArrowDown' });
      fireEvent.click(rows[1] as HTMLElement);

      expect(onScoreClick).toHaveBeenCalledWith('score-2');
    });
  });
});
