import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BOARD_RELEVANCE_TYPES } from '../boardRelevance';
import { BoardRelevanceFilters } from './BoardRelevanceFilters';

function renderFilters() {
  render(
    <BoardRelevanceFilters
      kind="work"
      participants={[]}
      selectedTypes={new Set(BOARD_RELEVANCE_TYPES)}
      availableLabels={['bug', 'documentation', '@mastra/core']}
      selectedLabels={new Set()}
      onParticipantChange={vi.fn()}
      onTypeChange={vi.fn()}
      onLabelChange={vi.fn()}
      onReset={vi.fn()}
    />,
  );
}

describe('BoardRelevanceFilters', () => {
  describe('when a user searches the available labels', () => {
    it('keeps the search focused and filters the selectable labels', async () => {
      const user = userEvent.setup();
      renderFilters();

      await user.click(screen.getByRole('button', { name: 'Filter by labels' }));
      const search = await screen.findByRole('searchbox', { name: 'Search labels' });
      await user.click(search);
      await user.type(search, 'core');

      expect(search).toHaveFocus();
      const menu = screen.getByRole('menu');
      expect(within(menu).getByText('@mastra/core')).toBeInTheDocument();
      expect(within(menu).queryByText('bug')).not.toBeInTheDocument();
      expect(within(menu).queryByText('documentation')).not.toBeInTheDocument();
    });
  });
});
