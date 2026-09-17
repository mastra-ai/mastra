// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FILTER_OPERATORS } from './default-operators';
import { FilterBar } from './filter-bar';
import type { FilterBarField, FilterBarItem } from './types';

const fields: FilterBarField[] = [
  {
    id: 'status',
    label: 'Status',
    operators: ['is', 'is-not', 'in', 'is-empty'],
    suggestions: [{ value: 'success' }, { value: 'error' }],
  },
  { id: 'duration', label: 'Duration', type: 'number', operators: ['gt'] },
];

function ButtonFilters({ onChange }: { onChange: (items: FilterBarItem[]) => void }) {
  const [items, setItems] = useState<FilterBarItem[]>([]);
  return (
    <FilterBar
      variant="button"
      fields={fields}
      operators={DEFAULT_FILTER_OPERATORS}
      value={items}
      onValueChange={nextItems => {
        setItems(nextItems);
        onChange(nextItems);
      }}
    >
      <FilterBar.Chips />
      <FilterBar.Input />
    </FilterBar>
  );
}

async function chooseOption(name: string) {
  fireEvent.click(await screen.findByRole('option', { name, exact: true }));
}

afterEach(cleanup);

describe('FilterBar button variant', () => {
  it('does not create a draft from typeahead keys while the button is closed', async () => {
    const onChange = vi.fn();
    render(<ButtonFilters onChange={onChange} />);
    const button = screen.getByRole('button', { name: 'Add filter' });
    button.focus();
    fireEvent.keyDown(button, { key: 's' });
    fireEvent.click(button);
    await screen.findByRole('option', { name: 'Status', exact: true });
    await waitFor(() => expect(button.textContent).toBe('Add filter'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens from a button, advances automatically and restores focus after adding a filter', async () => {
    const onChange = vi.fn();
    render(<ButtonFilters onChange={onChange} />);
    const button = screen.getByRole('button', { name: 'Add filter' });
    expect(screen.queryByRole('combobox', { name: 'Filter…' })).toBeNull();
    fireEvent.click(button);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('combobox')));

    await chooseOption('Status');
    expect(button.textContent).toContain('Operator…');
    await chooseOption('is');
    expect(button.textContent).toContain('Value…');
    await chooseOption('error');

    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ fieldId: 'status', operatorId: 'is', value: 'error' }),
    ]);
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Filter…' })).toBeNull());
    expect(document.activeElement).toBe(button);
    expect(screen.getByRole('group', { name: 'Status is error' })).toBeTruthy();
    await waitFor(() => expect(button.textContent).toBe(''));
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();

    fireEvent.click(button);
    await chooseOption('Status');
    await chooseOption('is empty');
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ fieldId: 'status', value: 'error' }),
      expect.objectContaining({ fieldId: 'status', operatorId: 'is-empty', value: '' }),
    ]);
  });

  it('steps back with Escape and discards the draft when dismissed', async () => {
    const onChange = vi.fn();
    render(<ButtonFilters onChange={onChange} />);
    const button = screen.getByRole('button', { name: 'Add filter' });
    fireEvent.click(button);
    await chooseOption('Status');
    await chooseOption('is');

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    await screen.findByRole('option', { name: 'is not', exact: true });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    await screen.findByRole('option', { name: 'Duration' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Filter…' })).toBeNull());
    expect(document.activeElement).toBe(button);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(button);
    await chooseOption('Status');
    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Filter…' })).toBeNull());
    await waitFor(() => expect(button.textContent).toBe('Add filter'));
  });

  it('skips an implied operator and preserves numeric validation and keyboard submission', async () => {
    const onChange = vi.fn();
    render(<ButtonFilters onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add filter' }));
    await chooseOption('Duration');
    const input = screen.getByRole('combobox', { name: 'Number…' });
    fireEvent.change(input, { target: { value: 'invalid' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '1500' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ fieldId: 'duration', operatorId: 'gt', value: 1500 }),
    ]);
  });

  it('keeps multi-select open until Done without offering a clear-all action', async () => {
    const onChange = vi.fn();
    render(<ButtonFilters onChange={onChange} />);
    const button = screen.getByRole('button', { name: 'Add filter' });
    fireEvent.click(button);
    await chooseOption('Status');
    await chooseOption('in');
    expect(button.textContent).toContain('Value…');
    await chooseOption('success');
    expect(button.textContent).toContain('success');
    expect(button.textContent).not.toContain('Value…');
    await chooseOption('error');
    expect(button.textContent).toContain('success, error');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Done/ }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ fieldId: 'status', operatorId: 'in', value: ['success', 'error'] }),
    ]);
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Filter…' })).toBeNull());
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(screen.queryByRole('combobox', { name: 'Filter…' })).toBeNull();
  });

  it('makes an exiting filter inaccessible immediately and keeps focus on Add filter', async () => {
    const onChange = vi.fn();
    render(<ButtonFilters onChange={onChange} />);
    const button = screen.getByRole('button', { name: 'Add filter' });
    fireEvent.click(button);
    await chooseOption('Status');
    await chooseOption('is');
    await chooseOption('error');
    const chip = screen.getByRole('group', { name: 'Status is error' });
    await waitFor(() => expect(button.textContent).toBe(''));

    fireEvent.click(screen.getByRole('button', { name: 'Remove Status filter' }));

    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.queryByRole('group', { name: 'Status is error' })).toBeNull();
    expect(chip.closest('[inert]')).not.toBeNull();
    expect(document.activeElement).toBe(button);
    await waitFor(() => expect(chip.isConnected).toBe(false));
    await waitFor(() => expect(button.textContent).toBe('Add filter'));
  });
});
