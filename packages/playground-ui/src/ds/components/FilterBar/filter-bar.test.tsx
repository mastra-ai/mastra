// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { DEFAULT_FILTER_OPERATORS } from './default-operators';
import { FilterBar } from './filter-bar';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from './types';

// eslint-friendly access to mock call arguments (avoids non-null assertions).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pressActive = (init: { key: string }) => fireEvent.keyDown(document.activeElement ?? document.body, init);
const argAt = (mock: { mock: { calls: any[][] } }, call: number, arg: number) => mock.mock.calls.at(call)?.at(arg);

beforeAll(() => {
  // jsdom ships no PointerEvent, and Base UI constructs one on press.
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEventStub extends MouseEvent {}
    window.PointerEvent = PointerEventStub as unknown as typeof PointerEvent;
  }
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const OPERATORS: FilterBarOperator[] = DEFAULT_FILTER_OPERATORS;

const FIELDS: FilterBarField[] = [
  {
    id: 'status',
    label: 'Status',
    operators: ['is', 'is-not', 'in', 'is-empty'],
    suggestions: [
      { value: 'running', label: 'Running' },
      { value: 'success', label: 'Success' },
      { value: 'error', label: 'Error' },
    ],
  },
  { id: 'traceId', label: 'Trace ID', operators: ['is', 'contains'] },
  {
    id: 'tags',
    label: 'Tags',
    operators: ['in'],
    strict: true,
    suggestions: [{ value: 'prod' }, { value: 'staging' }],
  },
];

function Harness({
  initial = [],
  fields = FIELDS,
  onChange,
  readOnlyIds = [],
}: {
  initial?: FilterBarItem[];
  fields?: FilterBarField[];
  onChange?: (items: FilterBarItem[]) => void;
  readOnlyIds?: string[];
}) {
  const [items, setItems] = useState<FilterBarItem[]>(initial);
  return (
    <FilterBar
      fields={fields}
      operators={OPERATORS}
      value={items}
      onValueChange={next => {
        setItems(next);
        onChange?.(next);
      }}
    >
      {readOnlyIds.length > 0 ? (
        items.map(item => <FilterBar.Chip key={item.id} item={item} readOnly={readOnlyIds.includes(item.id)} />)
      ) : (
        <FilterBar.Chips />
      )}
      <FilterBar.Input placeholder="Filter…" />
      <FilterBar.Clear />
    </FilterBar>
  );
}

const getInput = () => screen.getByRole('combobox', { name: 'Add filter' }) as HTMLInputElement;
const getChips = () => document.querySelectorAll<HTMLElement>('[data-slot="filter-bar-chip"]');

const type = (text: string) => fireEvent.change(getInput(), { target: { value: text } });
const key = (k: string, options: Record<string, unknown> = {}) => fireEvent.keyDown(getInput(), { key: k, ...options });

describe('FilterBar', () => {
  describe('typeahead input', () => {
    it('builds field → operator → value with the keyboard only', async () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);

      const input = getInput();
      input.focus();
      type('trace');
      await screen.findByRole('option', { name: 'Trace ID' });
      key('Enter');

      await screen.findByRole('option', { name: 'contains' });
      key('ArrowDown');
      key('Enter');

      expect(input.placeholder).toBe('Type a value, then Enter');
      type('abc-123');
      key('Enter');

      expect(onChange).toHaveBeenCalledTimes(1);
      const [items] = onChange.mock.calls[0] as [FilterBarItem[]];
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ fieldId: 'traceId', operatorId: 'contains', value: 'abc-123' });
      expect(typeof items.at(0)?.id).toBe('string');
      expect(input.value).toBe('');
      expect(document.activeElement).toBe(input);
      expect(getChips()).toHaveLength(1);
    });

    it('keeps the draft when the input itself is clicked mid-flow', async () => {
      render(<Harness />);
      const input = getInput();
      input.focus();
      type('status');
      key('Enter');
      await screen.findByRole('option', { name: 'is' });

      const press = (target: Element) => {
        fireEvent.pointerDown(target, { pointerType: 'mouse', button: 0 });
        fireEvent.mouseDown(target, { button: 0 });
        fireEvent.pointerUp(target, { pointerType: 'mouse', button: 0 });
        fireEvent.mouseUp(target, { button: 0 });
        fireEvent.click(target, { button: 0 });
      };

      press(input);
      expect(screen.getByRole('option', { name: 'is' })).toBeTruthy();
      expect(input.dataset.step).toBe('operator');

      press(document.body);
      await waitFor(() => expect(screen.queryByRole('option', { name: 'is' })).toBeNull());
    });

    it('picks a suggestion in the value step', async () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      getInput().focus();
      type('status');
      key('Enter');
      await screen.findByRole('option', { name: 'is' });
      key('Enter');
      await screen.findByRole('option', { name: 'Running' });
      key('ArrowDown');
      key('ArrowDown');
      key('Enter');
      expect(argAt(onChange, 0, 0)[0]).toMatchObject({ fieldId: 'status', operatorId: 'is', value: 'error' });
    });

    it('Escape and Backspace step back one level, Escape at the field step closes', async () => {
      render(<Harness />);
      const input = getInput();
      input.focus();
      type('status');
      key('Enter');
      await screen.findByRole('option', { name: 'is' });
      key('Enter');
      await screen.findByRole('listbox', { name: 'Values' });

      key('Escape');
      expect(input.getAttribute('data-step')).toBe('operator');
      key('Backspace');
      expect(input.getAttribute('data-step')).toBe('field');
      expect(input.getAttribute('aria-expanded')).toBe('true');
      key('Escape');
      expect(input.getAttribute('aria-expanded')).toBe('false');
    });

    it('commits immediately for arity "none" operators', async () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      getInput().focus();
      type('status');
      key('Enter');
      const emptyOp = await screen.findByRole('option', { name: 'is empty' });
      fireEvent.click(emptyOp);
      expect(argAt(onChange, 0, 0)[0]).toMatchObject({ fieldId: 'status', operatorId: 'is-empty', value: '' });
    });

    it('yields a string[] for arity "many" operators', async () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      getInput().focus();
      type('tags');
      key('Enter');
      await screen.findByRole('option', { name: 'in' });
      key('Enter');
      await screen.findByRole('option', { name: 'prod' });
      key('Enter'); // toggle prod
      key('ArrowDown');
      key('Enter'); // toggle staging
      expect(onChange).not.toHaveBeenCalled();
      key('Enter', { ctrlKey: true });
      expect(argAt(onChange, 0, 0)[0]).toMatchObject({
        fieldId: 'tags',
        operatorId: 'in',
        value: ['prod', 'staging'],
      });
    });

    it('does not commit free text for strict fields', async () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      getInput().focus();
      type('tags');
      key('Enter');
      key('Enter');
      await screen.findByRole('option', { name: 'prod' });
      type('zzz');
      await screen.findByText('No matching value.');
      key('Enter');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('Backspace on an empty input removes the last chip', () => {
      const onChange = vi.fn();
      render(
        <Harness
          onChange={onChange}
          initial={[
            { id: 'a', fieldId: 'status', operatorId: 'is', value: 'running' },
            { id: 'b', fieldId: 'traceId', operatorId: 'is', value: 'x' },
          ]}
        />,
      );
      getInput().focus();
      key('Backspace');
      expect(argAt(onChange, 0, 0)).toEqual([{ id: 'a', fieldId: 'status', operatorId: 'is', value: 'running' }]);
    });
  });

  describe('chips', () => {
    const INITIAL: FilterBarItem[] = [
      { id: 'a', fieldId: 'status', operatorId: 'is', value: 'running' },
      { id: 'b', fieldId: 'traceId', operatorId: 'is', value: 'x' },
    ];

    it('renders an accessible label per chip', () => {
      render(<Harness initial={INITIAL} />);
      expect(screen.getByRole('group', { name: 'Status is Running' })).toBeDefined();
      expect(screen.getByRole('group', { name: 'Trace ID is x' })).toBeDefined();
    });

    it('ArrowLeft from the empty input reaches the last chip, ArrowRight goes back to the input', () => {
      render(<Harness initial={INITIAL} />);
      const input = getInput();
      input.focus();
      key('ArrowLeft');
      const lastValue = screen.getByRole('button', { name: 'Value: x' });
      expect(document.activeElement).toBe(lastValue);

      const secondChip = screen.getByRole('group', { name: 'Trace ID is x' });
      fireEvent.keyDown(lastValue, { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(within(secondChip).getByRole('button', { name: 'Operator: is' }));
      pressActive({ key: 'ArrowLeft' });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Field: Trace ID' }));
      // Across chips
      pressActive({ key: 'ArrowLeft' });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove Status filter' }));

      pressActive({ key: 'ArrowRight' });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Field: Trace ID' }));
      pressActive({ key: 'ArrowRight' });
      pressActive({ key: 'ArrowRight' });
      pressActive({ key: 'ArrowRight' });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove Trace ID filter' }));
      pressActive({ key: 'ArrowRight' });
      expect(document.activeElement).toBe(input);
    });

    it('Delete on a chip removes it and moves focus to the neighbour', () => {
      const onChange = vi.fn();
      render(<Harness initial={INITIAL} onChange={onChange} />);
      const first = screen.getByRole('button', { name: 'Value: Running' });
      first.focus();
      fireEvent.keyDown(first, { key: 'Delete' });
      expect(argAt(onChange, 0, 0).map((i: FilterBarItem) => i.id)).toEqual(['b']);
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Value: x' }));
    });

    it('edits the value segment by clicking it', async () => {
      const onChange = vi.fn();
      render(<Harness initial={INITIAL} onChange={onChange} />);
      fireEvent.click(screen.getByRole('button', { name: 'Value: Running' }));
      const success = await screen.findByRole('option', { name: 'Success' });
      fireEvent.click(success);
      expect(argAt(onChange, 0, 0)[0]).toMatchObject({ id: 'a', value: 'success' });
      await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Values' })).toBeNull());
    });

    it('edits a free-text value with the keyboard', async () => {
      const onChange = vi.fn();
      render(<Harness initial={INITIAL} onChange={onChange} />);
      const value = screen.getByRole('button', { name: 'Value: x' });
      value.focus();
      fireEvent.click(value);
      const search = await screen.findByPlaceholderText('Type a value…');
      expect((search as HTMLInputElement).value).toBe('x');
      fireEvent.change(search, { target: { value: 'y' } });
      fireEvent.keyDown(search, { key: 'Enter' });
      expect(argAt(onChange, 0, 0)[1]).toMatchObject({ id: 'b', value: 'y' });
    });

    it('resets the value when the operator arity changes', async () => {
      const onChange = vi.fn();
      render(<Harness initial={INITIAL} onChange={onChange} />);
      const chip = screen.getByRole('group', { name: 'Status is Running' });
      fireEvent.click(within(chip).getByRole('button', { name: 'Operator: is' }));
      fireEvent.click(await screen.findByRole('option', { name: 'in' }));
      expect(argAt(onChange, 0, 0)[0]).toMatchObject({ id: 'a', operatorId: 'in', value: [] });
    });

    it('keeps the value when switching between operators of the same arity', async () => {
      const onChange = vi.fn();
      render(<Harness initial={INITIAL} onChange={onChange} />);
      const chip = screen.getByRole('group', { name: 'Status is Running' });
      fireEvent.click(within(chip).getByRole('button', { name: 'Operator: is' }));
      fireEvent.click(await screen.findByRole('option', { name: 'is not' }));
      expect(argAt(onChange, 0, 0)[0]).toMatchObject({ id: 'a', operatorId: 'is-not', value: 'running' });
    });

    it('changing the field falls back to an allowed operator and clears the value', async () => {
      const onChange = vi.fn();
      render(
        <Harness
          initial={[{ id: 'a', fieldId: 'status', operatorId: 'is-not', value: 'running' }]}
          onChange={onChange}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Field: Status' }));
      fireEvent.click(await screen.findByRole('option', { name: 'Trace ID' }));
      expect(argAt(onChange, 0, 0)[0]).toMatchObject({ id: 'a', fieldId: 'traceId', operatorId: 'is', value: '' });
    });

    it('readOnly chips expose no editors and are skipped by keyboard navigation', () => {
      render(<Harness initial={INITIAL} readOnlyIds={['b']} />);
      const locked = screen.getByRole('group', { name: 'Trace ID is x' });
      expect(within(locked).queryAllByRole('button')).toHaveLength(0);
      getInput().focus();
      key('ArrowLeft');
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Value: Running' }));
    });

    it('Clear empties the bar and focuses the input', () => {
      const onChange = vi.fn();
      render(<Harness initial={INITIAL} onChange={onChange} />);
      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
      expect(onChange).toHaveBeenCalledWith([]);
      expect(document.activeElement).toBe(getInput());
      expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    });
  });

  describe('lazy suggestions', () => {
    it('calls the resolver only once the value step opens, with query/operator/signal', async () => {
      const resolver = vi.fn(async ({ query }: { query: string }) =>
        ['alpha', 'beta'].filter(v => v.includes(query)).map(value => ({ value })),
      );
      const fields: FilterBarField[] = [{ id: 'name', label: 'Name', operators: ['is'], suggestions: resolver }];
      const onChange = vi.fn();
      render(<Harness fields={fields} onChange={onChange} />);

      expect(resolver).not.toHaveBeenCalled();
      getInput().focus();
      type('name');
      key('Enter');
      await screen.findByRole('option', { name: 'is' });
      expect(resolver).not.toHaveBeenCalled();
      key('Enter');

      await screen.findByText('Loading…');
      await screen.findByRole('option', { name: 'alpha' });
      expect(resolver).toHaveBeenCalledTimes(1);
      expect(argAt(resolver, 0, 0)).toMatchObject({ query: '', operatorId: 'is' });
      expect(argAt(resolver, 0, 0).signal).toBeInstanceOf(AbortSignal);

      type('bet');
      await waitFor(() => expect(screen.queryByRole('option', { name: 'alpha' })).toBeNull());
      expect(resolver).toHaveBeenCalledTimes(2);
      expect(argAt(resolver, 1, 0)).toMatchObject({ query: 'bet' });
      await screen.findByRole('option', { name: 'beta' });
      key('Enter');
      expect(argAt(onChange, 0, 0)[0]).toMatchObject({ fieldId: 'name', operatorId: 'is', value: 'beta' });
    });

    it('discards stale responses', async () => {
      const deferred: Array<(v: { value: string }[]) => void> = [];
      const resolver = vi.fn(() => new Promise<{ value: string }[]>(resolve => deferred.push(resolve)));
      const fields: FilterBarField[] = [{ id: 'name', label: 'Name', operators: ['is'], suggestions: resolver }];
      render(<Harness fields={fields} />);
      getInput().focus();
      type('name');
      key('Enter');
      key('Enter');
      await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
      type('b');
      await waitFor(() => expect(resolver).toHaveBeenCalledTimes(2));

      await act(async () => {
        deferred.at(1)?.([{ value: 'fresh' }]);
      });
      await screen.findByRole('option', { name: 'fresh' });
      await act(async () => {
        deferred.at(0)?.([{ value: 'stale' }]);
      });
      expect(screen.queryByRole('option', { name: 'stale' })).toBeNull();
      expect(screen.getByRole('option', { name: 'fresh' })).toBeDefined();
    });

    it('shows an error row and still accepts free text', async () => {
      const resolver = vi.fn(async () => {
        throw new Error('boom');
      });
      const fields: FilterBarField[] = [{ id: 'name', label: 'Name', operators: ['is'], suggestions: resolver }];
      const onChange = vi.fn();
      render(<Harness fields={fields} onChange={onChange} />);
      getInput().focus();
      type('name');
      key('Enter');
      key('Enter');
      await screen.findByText("Couldn't load values.");
      type('manual');
      await screen.findByText("Couldn't load values.");
      key('Enter');
      expect(argAt(onChange, 0, 0)[0]).toMatchObject({ value: 'manual' });
    });
  });
});
