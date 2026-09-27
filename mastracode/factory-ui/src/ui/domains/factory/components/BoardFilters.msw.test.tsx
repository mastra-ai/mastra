import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { boardFiltersFromParams } from '../boardFilters';
import type { BoardFilterState } from '../boardFilters';
import { BoardFilters } from './BoardFilters';

const NEUTRAL = boardFiltersFromParams(new URLSearchParams(), 'work');

function renderFilters(filters: BoardFilterState = NEUTRAL) {
  const onFiltersChange = vi.fn();
  const view = render(
    <BoardFilters
      kind="work"
      participants={[{ id: 'github:alice', name: 'Alice', source: 'github' }]}
      availableLabels={['bug', 'documentation', '@mastra/core']}
      currentUserId="me"
      filters={filters}
      onFiltersChange={onFiltersChange}
    />,
  );
  return { onFiltersChange, view };
}

const input = () => screen.getByRole('combobox', { name: 'Add filter' });
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });
const key = (k: string, options: Record<string, unknown> = {}) => fireEvent.keyDown(input(), { key: k, ...options });

describe('BoardFilters', () => {
  it('turns typed text into a search filter without picking a field first', async () => {
    const { onFiltersChange } = renderFilters();
    input().focus();

    type('flaky login');
    await screen.findByRole('option', { name: /contains "flaky login"/ });
    key('Enter');

    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ search: 'flaky login' }));
  });

  it('keeps the teammate one arrow below the search entry, and reports the picked participant', async () => {
    const { onFiltersChange } = renderFilters();
    input().focus();

    type('teammate');
    await screen.findByRole('option', { name: 'Teammate' });
    key('ArrowDown');
    key('Enter');

    await screen.findByRole('option', { name: /Alice/ });
    key('Enter');

    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ participantId: 'github:alice' }));
  });

  it('offers relevance only once a teammate narrows the board', async () => {
    const { view } = renderFilters();
    input().focus();
    type('relevant');
    await screen.findByRole('listbox', { name: 'Fields' });
    expect(screen.queryByRole('option', { name: 'Relevant because' })).toBeNull();

    view.rerender(
      <BoardFilters
        kind="work"
        participants={[{ id: 'github:alice', name: 'Alice', source: 'github' }]}
        availableLabels={[]}
        filters={{ ...NEUTRAL, participantId: 'github:alice' }}
        onFiltersChange={vi.fn()}
      />,
    );

    expect(await screen.findByRole('option', { name: 'Relevant because' })).toBeTruthy();
  });

  it('commits several labels as one filter', async () => {
    const { onFiltersChange } = renderFilters();
    input().focus();

    type('label');
    await screen.findByRole('option', { name: 'Label' });
    key('ArrowDown');
    key('Enter');

    await screen.findByRole('option', { name: 'bug' });
    key('Enter');
    key('ArrowDown');
    key('Enter');
    key('Enter', { metaKey: true });

    const [filters] = onFiltersChange.mock.calls.at(-1) as [BoardFilterState];
    expect(filters.labels).toEqual(new Set(['bug', 'documentation']));
  });

  it('drops every filter at once', () => {
    const { onFiltersChange } = renderFilters({ ...NEUTRAL, search: 'auth', labels: new Set(['bug']) });

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: '', participantId: undefined, labels: new Set() }),
    );
  });
});
