// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import { FilterableList } from '../filterable-list';

// Base UI's Checkbox synthesizes a PointerEvent on click, which jsdom does not
// implement; alias it to MouseEvent so click handlers run.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

const items = [
  { id: 'alpha', label: 'Alpha' },
  { id: 'beta', label: 'Beta' },
  { id: 'gamma', label: 'Gamma' },
];

const renderList = (overrides: Partial<Parameters<typeof FilterableList>[0]> = {}) => {
  const onToggle = vi.fn();
  const onSelectAll = vi.fn();
  const onClearAll = vi.fn();
  const checked = new Set(['alpha', 'beta', 'gamma']);

  const utils = render(
    <AgentColorProvider agentId="agent_test">
      <FilterableList
        title="Providers"
        items={items}
        isChecked={id => checked.has(id)}
        onToggle={onToggle}
        onSelectAll={onSelectAll}
        onClearAll={onClearAll}
        testIdPrefix="list"
        {...overrides}
      />
    </AgentColorProvider>,
  );

  return { ...utils, onToggle, onSelectAll, onClearAll };
};

describe('FilterableList', () => {
  afterEach(() => cleanup());

  it('renders a row and checkbox per item', () => {
    const { getByTestId } = renderList();

    for (const item of items) {
      expect(getByTestId(`list-filter-item-${item.id}`)).toBeTruthy();
      expect(getByTestId(`list-filter-checkbox-${item.id}`).getAttribute('aria-checked')).toBe('true');
    }
  });

  it('local search filters the rows by label', async () => {
    const { getByTestId, queryByTestId } = renderList();

    const input = getByTestId('list-filter-search').querySelector('input');
    expect(input).toBeTruthy();
    fireEvent.change(input!, { target: { value: 'bet' } });

    await waitFor(() => expect(queryByTestId('list-filter-item-alpha')).toBeNull());
    expect(queryByTestId('list-filter-item-beta')).toBeTruthy();
    expect(queryByTestId('list-filter-item-gamma')).toBeNull();
  });

  it('toggling a checkbox calls onToggle with the item id', () => {
    const { getByTestId, onToggle } = renderList();

    fireEvent.click(getByTestId('list-filter-checkbox-beta'));

    expect(onToggle).toHaveBeenCalledWith('beta');
  });

  it('Select all / Clear all call their handlers', () => {
    const { getByTestId, onSelectAll, onClearAll } = renderList();

    fireEvent.click(getByTestId('list-filter-select-all'));
    expect(onSelectAll).toHaveBeenCalledTimes(1);

    fireEvent.click(getByTestId('list-filter-clear-all'));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('paints checked checkboxes with the agent color', () => {
    const { getByTestId } = renderList({ isChecked: id => id === 'alpha' });

    const checked = getByTestId('list-filter-checkbox-alpha') as HTMLButtonElement;
    expect(checked.style.backgroundColor).toMatch(/^(rgb|hsl)\(/);
    expect(checked.style.borderColor).toMatch(/^(rgb|hsl)\(/);

    const unchecked = getByTestId('list-filter-checkbox-beta') as HTMLButtonElement;
    expect(unchecked.getAttribute('style')).toBeNull();
  });

  it('shows a no-matches message when the search excludes everything', async () => {
    const { getByTestId, findByText } = renderList();

    const input = getByTestId('list-filter-search').querySelector('input');
    fireEvent.change(input!, { target: { value: 'zzz' } });

    expect(await findByText('No matches')).toBeTruthy();
  });

  it('disables controls when disabled', () => {
    const { getByTestId } = renderList({ disabled: true });

    expect((getByTestId('list-filter-select-all') as HTMLButtonElement).disabled).toBe(true);
    expect((getByTestId('list-filter-clear-all') as HTMLButtonElement).disabled).toBe(true);
    expect(getByTestId('list-filter-checkbox-alpha').hasAttribute('data-disabled')).toBe(true);
  });
});
