import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { boardFilterParams, boardFiltersFromParams } from '../boardFilters';
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

function renderControlledFilters(kind: 'work' | 'review' = 'work') {
  function Harness() {
    const [params, setParams] = useState(new URLSearchParams());
    return (
      <>
        <output data-testid="filter-url">{params.toString()}</output>
        <BoardFilters
          kind={kind}
          participants={[{ id: 'github:alice', name: 'Alice', source: 'github' }]}
          availableLabels={['bug', 'documentation', '@mastra/core']}
          filters={boardFiltersFromParams(params, kind)}
          onFiltersChange={next => setParams(boardFilterParams(params, next, kind))}
        />
      </>
    );
  }
  return render(<Harness />);
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

  it('round-trips committed labels through the URL and controlled value', async () => {
    renderControlledFilters();
    input().focus();
    type('label');
    await screen.findByRole('option', { name: 'Label' });
    key('ArrowDown');
    key('Enter');
    await screen.findByRole('option', { name: 'bug' });
    fireEvent.click(screen.getByRole('option', { name: 'bug' }));
    fireEvent.click(screen.getByRole('option', { name: 'documentation' }));
    fireEvent.click(screen.getByRole('button', { name: /^Done/ }));

    expect(screen.getByTestId('filter-url').textContent).toContain('label=bug');
    expect(screen.getByTestId('filter-url').textContent).toContain('label=documentation');
    expect(screen.getByRole('button', { name: 'Remove Label filter' })).toBeTruthy();
    fireEvent.click(screen.getByRole('combobox', { name: /^Value:/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'bug' }));
    fireEvent.click(screen.getByRole('button', { name: /^Done/ }));
    expect(screen.getByTestId('filter-url').textContent).not.toContain('label=bug');
    expect(screen.getByTestId('filter-url').textContent).toContain('label=documentation');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Label filter' }));
    expect(screen.getByTestId('filter-url').textContent).not.toContain('label=');
  });

  it('round-trips teammate and multiple relevance types through the review URL', async () => {
    renderControlledFilters('review');
    input().focus();
    type('teammate');
    await screen.findByRole('option', { name: 'Teammate' });
    key('ArrowDown');
    key('Enter');
    await screen.findByRole('option', { name: /Alice/ });
    key('Enter');

    expect(screen.getByTestId('filter-url').textContent).toContain('teammate=github%3Aalice');
    type('relevant');
    await screen.findByRole('option', { name: 'Relevant because' });
    key('ArrowDown');
    key('Enter');
    await screen.findByRole('option', { name: /Authored/i });
    fireEvent.click(screen.getByRole('option', { name: /Authored/i }));
    fireEvent.click(screen.getByRole('option', { name: /Review requested/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Done/ }));

    expect(screen.getByTestId('filter-url').textContent).toContain('relevance=authored%2Creview-requested');
    expect(screen.getByRole('button', { name: 'Remove Relevant because filter' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Relevant because filter' }));
    expect(screen.getByTestId('filter-url').textContent).not.toContain('relevance=');
    expect(screen.getByTestId('filter-url').textContent).toContain('teammate=github%3Aalice');
  });

  it('drops every filter at once', () => {
    const { onFiltersChange } = renderFilters({ ...NEUTRAL, search: 'auth', labels: new Set(['bug']) });

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: '', participantId: undefined, labels: new Set() }),
    );
  });
});
