import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { BOARD_RELEVANCE_TYPES } from '../boardRelevance';
import { BoardRelevanceFilters } from './BoardRelevanceFilters';

type FiltersProps = ComponentProps<typeof BoardRelevanceFilters>;

function renderFilters(overrides: Partial<FiltersProps> = {}) {
  const callbacks = {
    onParticipantChange: vi.fn(),
    onTypeChange: vi.fn(),
    onLabelChange: vi.fn(),
    onReset: vi.fn(),
  };

  render(
    <BoardRelevanceFilters
      kind="work"
      participants={[{ id: 'github:alice', name: 'Alice', source: 'github' }]}
      selectedTypes={new Set(BOARD_RELEVANCE_TYPES)}
      availableLabels={['bug', 'documentation', '@mastra/core']}
      selectedLabels={new Set()}
      {...callbacks}
      {...overrides}
    />,
  );

  return callbacks;
}

function mobileFilters() {
  return within(screen.getByLabelText('Board filters mobile'));
}

describe('BoardRelevanceFilters', () => {
  it('wires the mobile teammate selection to the shared filter callback', async () => {
    const user = userEvent.setup();
    const callbacks = renderFilters();

    await user.click(mobileFilters().getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /Alice/ }));

    expect(callbacks.onParticipantChange).toHaveBeenCalledWith('github:alice');
  });

  it('wires the mobile relevance and label controls to the shared filter callbacks', async () => {
    const user = userEvent.setup();
    const callbacks = renderFilters({ selectedParticipantId: 'github:alice' });

    await user.click(mobileFilters().getByRole('button', { name: 'Filter by relevance' }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Worked on' }));
    expect(callbacks.onTypeChange).toHaveBeenCalledWith('worked', false);

    await user.click(mobileFilters().getByRole('button', { name: 'Filter by labels' }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'bug' }));
    expect(callbacks.onLabelChange).toHaveBeenCalledWith('bug', true);
  });

  it('wires the mobile reset action to the shared filter callback', async () => {
    const user = userEvent.setup();
    const callbacks = renderFilters({ selectedLabels: new Set(['bug']) });

    await user.click(mobileFilters().getByRole('button', { name: 'Reset filters' }));

    expect(callbacks.onReset).toHaveBeenCalledOnce();
  });

  describe('when a user searches the available labels', () => {
    it('keeps the search focused and filters the selectable labels', async () => {
      const user = userEvent.setup();
      renderFilters();

      await user.click(mobileFilters().getByRole('button', { name: 'Filter by labels' }));
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
