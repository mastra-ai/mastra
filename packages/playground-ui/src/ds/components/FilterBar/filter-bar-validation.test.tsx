// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FILTER_OPERATORS } from './default-operators';
import { FilterBar } from './filter-bar';
import type { FilterBarProps } from './filter-bar';
import type { FilterBarField, FilterBarItem } from './types';

const fields: FilterBarField[] = [
  { id: 'tags', label: 'Tags', operators: ['in'], suggestions: [{ value: 'production' }, { value: 'regression' }] },
  { id: 'duration', label: 'Duration', type: 'number', operators: ['gt', 'lt'] },
  { id: 'budget', label: 'Budget', type: 'number', operators: ['is'], suggestions: [{ value: '10', label: 'Quick' }] },
];
const initialTags: FilterBarItem[] = [
  { id: 'tags-1', fieldId: 'tags', operatorId: 'in', value: ['production', 'regression'] },
  { id: 'tags-2', fieldId: 'tags', operatorId: 'in', value: ['regression'] },
];

function Filters({
  variant,
  initial = initialTags,
  onChange,
}: {
  variant: FilterBarProps['variant'];
  initial?: FilterBarItem[];
  onChange: (items: FilterBarItem[]) => void;
}) {
  const [items, setItems] = useState(initial);
  return (
    <FilterBar
      variant={variant}
      fields={fields}
      operators={DEFAULT_FILTER_OPERATORS}
      value={items}
      onValueChange={next => {
        setItems(next);
        onChange(next);
      }}
    >
      <FilterBar.Chips />
      <FilterBar.Input />
    </FilterBar>
  );
}

afterEach(cleanup);

describe.each(['input', 'button'] satisfies FilterBarProps['variant'][])('%s numeric validation', variant => {
  it('explains invalid input without discarding existing filters, then accepts zero', async () => {
    const onChange = vi.fn<(items: FilterBarItem[]) => void>();
    render(<Filters variant={variant} onChange={onChange} />);
    if (variant === 'button') fireEvent.click(screen.getByRole('button', { name: 'Add filter' }));
    else fireEvent.focus(screen.getByRole('combobox', { name: 'Add filter' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Duration' }));
    const input = screen.getByPlaceholderText<HTMLInputElement>('Operator…');
    fireEvent.change(input, { target: { value: '>' } });
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    fireEvent.click(await screen.findByRole('option', { name: '>', exact: true }));
    const apply = await screen.findByRole<HTMLButtonElement>('button', { name: /^Apply/ });
    expect(screen.getByText('Type a number')).toBeTruthy();
    expect(apply.disabled).toBe(true);

    for (const value of ['test', 'Infinity']) {
      fireEvent.change(input, { target: { value } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent).toContain(
        'Enter a number.',
      );
      expect(apply.disabled).toBe(true);
      expect(input.value).toBe(value);
      expect(onChange).not.toHaveBeenCalled();
    }

    fireEvent.change(input, { target: { value: ' ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(apply.disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '0' } });
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(screen.queryByText('Enter a number.')).toBeNull();
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);
    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      ...initialTags,
      expect.objectContaining({ fieldId: 'duration', operatorId: 'gt', value: 0 }),
    ]);
    await screen.findByRole('group', { name: 'Duration > 0' });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole(variant === 'button' ? 'button' : 'combobox', { name: 'Add filter' }),
      ),
    );
  });

  it('keeps the saved number while its editor is invalid and accepts a corrected decimal', async () => {
    const onChange = vi.fn<(items: FilterBarItem[]) => void>();
    const duration: FilterBarItem = { id: 'duration-1', fieldId: 'duration', operatorId: 'gt', value: 1500 };
    render(<Filters variant={variant} initial={[duration]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Value: 1500' }));
    const input = await screen.findByPlaceholderText<HTMLInputElement>('Type a number…');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent).toContain(
      'Enter a number.',
    );
    expect(screen.getByRole('group', { name: 'Duration > 1500' })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '-12.5' } });
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledExactlyOnceWith([{ ...duration, value: -12.5 }]);
    await waitFor(() => expect(screen.queryByPlaceholderText('Type a number…')).toBeNull());
  });

  it('allows searching numeric suggestions by their text label', async () => {
    const onChange = vi.fn<(items: FilterBarItem[]) => void>();
    render(<Filters variant={variant} initial={[]} onChange={onChange} />);
    if (variant === 'button') fireEvent.click(screen.getByRole('button', { name: 'Add filter' }));
    else fireEvent.focus(screen.getByRole('combobox', { name: 'Add filter' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Budget' }));
    const input = screen.getByPlaceholderText<HTMLInputElement>('Search or type a number…');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(await screen.findByText('Enter a number.')).toBeTruthy();
    expect(screen.queryByText('No suggestions — press Enter to use your text.')).toBeNull();
    fireEvent.change(input, { target: { value: 'Quick' } });
    const suggestion = await screen.findByRole('option', { name: 'Quick' });
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    fireEvent.click(suggestion);
    expect(onChange).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ fieldId: 'budget', operatorId: 'is', value: 10 }),
    ]);
  });
});
