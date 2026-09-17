// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_FILTER_OPERATORS } from './default-operators';
import { FilterBar } from './filter-bar';
import type { FilterBarField, FilterBarItem } from './types';

const fields: FilterBarField[] = [
  {
    id: 'status',
    label: 'Status',
    operators: ['is', 'in'],
    suggestions: [{ value: 'success' }, { value: 'error' }],
  },
];

function InputFilters({ onChange }: { onChange: (items: FilterBarItem[]) => void }) {
  const [items, setItems] = useState<FilterBarItem[]>([]);
  return (
    <FilterBar
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

afterEach(cleanup);

it('previews selected values until Done while preserving the inline input and focus', async () => {
  const onChange = vi.fn<(items: FilterBarItem[]) => void>();
  render(<InputFilters onChange={onChange} />);
  const input = screen.getByRole<HTMLInputElement>('combobox', { name: 'Add filter' });
  fireEvent.focus(input);
  fireEvent.click(await screen.findByRole('option', { name: 'Status' }));
  fireEvent.click(await screen.findByRole('option', { name: 'in', exact: true }));
  fireEvent.click(await screen.findByRole('option', { name: 'success' }));
  fireEvent.click(await screen.findByRole('option', { name: 'error' }));

  expect(screen.getByText('success, error')).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('combobox', { name: 'Add filter' })).toBe(input);

  fireEvent.click(screen.getByRole('option', { name: 'success' }));
  expect(screen.queryByText('success, error')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Done/ }));

  expect(onChange).toHaveBeenCalledExactlyOnceWith([
    expect.objectContaining({ fieldId: 'status', operatorId: 'in', value: ['error'] }),
  ]);
  await waitFor(() => expect(screen.getByRole('group', { name: 'Status in error' })).toBeTruthy());
  expect(screen.getByRole('combobox', { name: 'Add filter' })).toBe(input);
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe('');
  expect(input.placeholder).toBe('Filter…');
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(await screen.findByRole('button', { name: 'Clear filters' })).toBeTruthy();
});
