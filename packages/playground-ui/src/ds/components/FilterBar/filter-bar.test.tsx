// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { DEFAULT_FILTER_OPERATORS } from './default-operators';
import { FilterBar } from './filter-bar';
import { useFilterBarContext } from './filter-bar-context';
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
  { id: 'duration', label: 'Duration', type: 'number', operators: ['gt'] },
  { id: 'hasError', label: 'Has error', type: 'boolean', operators: ['is'] },
];

function Harness({
  initial = [],
  fields = FIELDS,
  onChange,
  readOnlyIds = [],
  nonRemovableIds = [],
}: {
  initial?: FilterBarItem[];
  fields?: FilterBarField[];
  onChange?: (items: FilterBarItem[]) => void;
  readOnlyIds?: string[];
  nonRemovableIds?: string[];
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
      {readOnlyIds.length > 0 || nonRemovableIds.length > 0 ? (
        items.map(item => (
          <FilterBar.Chip
            key={item.id}
            item={item}
            readOnly={readOnlyIds.includes(item.id)}
            removable={!nonRemovableIds.includes(item.id)}
          />
        ))
      ) : (
        <FilterBar.Chips />
      )}
      <FilterBar.Input placeholder="Filter…" />
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

      expect(input.placeholder).toBe('Value…');
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

    it('commits a free-text value from the inline Apply button', async () => {
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

      const apply = (await screen.findByRole('button', { name: /^Apply/ })) as HTMLButtonElement;
      expect(apply.disabled).toBe(true);
      type('abc-123');
      expect(apply.disabled).toBe(false);
      fireEvent.click(apply);

      const [items] = onChange.mock.calls[0] as [FilterBarItem[]];
      expect(items[0]).toMatchObject({ fieldId: 'traceId', operatorId: 'contains', value: 'abc-123' });
      expect(getChips()).toHaveLength(1);
    });

    it('rejects non-numeric free text on a number field', async () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);

      const input = getInput();
      input.focus();
      type('duration');
      await screen.findByRole('option', { name: 'Duration' });
      key('Enter');

      expect(input.inputMode).toBe('decimal');
      const apply = (await screen.findByRole('button', { name: /^Apply/ })) as HTMLButtonElement;
      type('abc');
      expect(apply.disabled).toBe(true);
      key('Enter');
      expect(onChange).not.toHaveBeenCalled();

      type('1500');
      expect(apply.disabled).toBe(false);
      key('Enter');
      const [items] = onChange.mock.calls[0] as [FilterBarItem[]];
      expect(items[0]).toMatchObject({ fieldId: 'duration', operatorId: 'gt', value: 1500 });
      expect(getChips()[0]?.textContent).toContain('1500');
    });

    it('offers strict True/False suggestions on a boolean field', async () => {
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);

      const input = getInput();
      input.focus();
      type('has error');
      await screen.findByRole('option', { name: 'Has error' });
      key('Enter');

      await screen.findByRole('option', { name: 'True' });
      expect(screen.getByRole('option', { name: 'False' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /^Apply/ })).toBeNull();

      type('fal');
      await screen.findByRole('option', { name: 'False' });
      key('Enter');
      const [items] = onChange.mock.calls[0] as [FilterBarItem[]];
      expect(items[0]).toMatchObject({ fieldId: 'hasError', operatorId: 'is', value: false });
      expect(getChips()[0]?.textContent).toContain('False');
    });

    it('moves the highlight with the arrow keys and mirrors it in aria-activedescendant', async () => {
      render(<Harness />);
      const input = getInput();
      input.focus();
      const first = await screen.findByRole('option', { name: 'Status' });
      const second = screen.getByRole('option', { name: 'Trace ID' });

      await waitFor(() => expect(input.getAttribute('aria-activedescendant')).toBe(first.id));
      expect(first.hasAttribute('data-highlighted')).toBe(true);

      key('ArrowDown');
      await waitFor(() => expect(input.getAttribute('aria-activedescendant')).toBe(second.id));
      expect(second.hasAttribute('data-highlighted')).toBe(true);
      expect(first.hasAttribute('data-highlighted')).toBe(false);

      key('ArrowUp');
      await waitFor(() => expect(input.getAttribute('aria-activedescendant')).toBe(first.id));
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

    it('accumulates the draft as an inline chip next to the input', async () => {
      render(<Harness />);
      const input = getInput();
      const draftChip = () => document.querySelector('[data-slot="filter-bar-draft-chip"]');

      input.focus();
      expect(draftChip()).toBeNull();

      type('status');
      key('Enter');
      await screen.findByRole('option', { name: 'is' });
      expect(draftChip()?.textContent).toBe('Status');
      expect(input.placeholder).toBe('Operator…');

      key('Enter');
      await screen.findByRole('listbox', { name: 'Values' });
      expect(draftChip()?.textContent).toBe('Statusis');

      key('Escape');
      expect(draftChip()?.textContent).toBe('Status');
      key('Backspace');
      expect(draftChip()).toBeNull();

      type('status');
      key('Enter');
      await screen.findByRole('option', { name: 'is' });
      key('Enter');
      await screen.findByRole('option', { name: 'Running' });
      key('Enter');
      expect(draftChip()).toBeNull();
      expect(getChips()).toHaveLength(1);
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
      await screen.findByRole('option', { name: 'prod' });
      type('zzz');
      await screen.findByText('No matching value.');
      key('Enter');
      expect(onChange).not.toHaveBeenCalled();
      // The rejected value must not close or reset the draft.
      const input = getInput();
      expect(input.dataset.step).toBe('value');
      expect(input.getAttribute('aria-expanded')).toBe('true');
      expect(input.value).toBe('zzz');
    });

    describe('when a field has a single operator', () => {
      it('skips the operator step and goes straight to the value', async () => {
        const onChange = vi.fn();
        render(<Harness onChange={onChange} />);
        getInput().focus();
        type('duration');
        key('Enter');
        expect(getInput().dataset.step).toBe('value');
        expect(screen.queryByRole('option', { name: '>' })).toBeNull();
        type('42');
        key('Enter');
        expect(argAt(onChange, 0, 0)[0]).toMatchObject({ fieldId: 'duration', operatorId: 'gt', value: 42 });
      });

      it('steps back from the value straight to the field step', () => {
        render(<Harness />);
        getInput().focus();
        type('duration');
        key('Enter');
        expect(getInput().dataset.step).toBe('value');
        key('Escape');
        expect(getInput().dataset.step).toBe('field');
      });

      it('does not render the operator segment on the draft chip', () => {
        render(<Harness />);
        getInput().focus();
        type('duration');
        key('Enter');
        const draft = document.querySelector('[data-slot="filter-bar-draft-chip"]');
        expect(draft?.textContent).toBe('Duration');
      });

      it('does not render the operator segment on the chip', () => {
        render(<Harness initial={[{ id: 'a', fieldId: 'duration', operatorId: 'gt', value: 5 }]} />);
        const chip = getChips()[0];
        expect(within(chip).queryByRole('combobox', { name: 'Operator: >' })).toBeNull();
        expect(chip.getAttribute('aria-label')).toBe('Duration 5');
        expect(within(chip).getByRole('combobox', { name: 'Field: Duration' })).toBeTruthy();
        expect(within(chip).getByRole('combobox', { name: 'Value: 5' })).toBeTruthy();
      });
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

    it('ArrowLeft from the empty input reaches the last chip remove button, ArrowRight goes back to the input', () => {
      render(<Harness initial={INITIAL} />);
      const input = getInput();
      input.focus();
      key('ArrowLeft');
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove Trace ID filter' }));

      const secondChip = screen.getByRole('group', { name: 'Trace ID is x' });
      pressActive({ key: 'ArrowLeft' });
      expect(document.activeElement).toBe(within(secondChip).getByRole('combobox', { name: 'Value: x' }));
      pressActive({ key: 'ArrowLeft' });
      expect(document.activeElement).toBe(within(secondChip).getByRole('combobox', { name: 'Operator: is' }));
      pressActive({ key: 'ArrowLeft' });
      expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Field: Trace ID' }));
      // Across chips
      pressActive({ key: 'ArrowLeft' });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove Status filter' }));

      pressActive({ key: 'ArrowRight' });
      expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Field: Trace ID' }));
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
      const first = screen.getByRole('combobox', { name: 'Value: Running' });
      first.focus();
      fireEvent.keyDown(first, { key: 'Delete' });
      expect(argAt(onChange, 0, 0).map((i: FilterBarItem) => i.id)).toEqual(['b']);
      expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Value: x' }));
    });

    it('edits the value segment by clicking it', async () => {
      const onChange = vi.fn();
      render(<Harness initial={INITIAL} onChange={onChange} />);
      fireEvent.click(screen.getByRole('combobox', { name: 'Value: Running' }));
      const success = await screen.findByRole('option', { name: 'Success' });
      fireEvent.click(success);
      expect(argAt(onChange, 0, 0)[0]).toMatchObject({ id: 'a', value: 'success' });
      await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Values' })).toBeNull());
    });

    it('edits a free-text value with the keyboard', async () => {
      const onChange = vi.fn();
      render(<Harness initial={INITIAL} onChange={onChange} />);
      const value = screen.getByRole('combobox', { name: 'Value: x' });
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
      fireEvent.click(within(chip).getByRole('combobox', { name: 'Operator: is' }));
      fireEvent.click(await screen.findByRole('option', { name: 'in' }));
      expect(argAt(onChange, 0, 0)[0]).toMatchObject({ id: 'a', operatorId: 'in', value: [] });
    });

    it('keeps the value when switching between operators of the same arity', async () => {
      const onChange = vi.fn();
      render(<Harness initial={INITIAL} onChange={onChange} />);
      const chip = screen.getByRole('group', { name: 'Status is Running' });
      fireEvent.click(within(chip).getByRole('combobox', { name: 'Operator: is' }));
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
      fireEvent.click(screen.getByRole('combobox', { name: 'Field: Status' }));
      fireEvent.click(await screen.findByRole('option', { name: 'Trace ID' }));
      expect(argAt(onChange, 0, 0)[0]).toMatchObject({ id: 'a', fieldId: 'traceId', operatorId: 'is', value: '' });
    });

    it('readOnly chips expose no editors and are skipped by keyboard navigation', () => {
      render(<Harness initial={INITIAL} readOnlyIds={['b']} />);
      const locked = screen.getByRole('group', { name: 'Trace ID is x' });
      expect(within(locked).queryAllByRole('button')).toHaveLength(0);
      getInput().focus();
      key('ArrowLeft');
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove Status filter' }));
    });

    describe('when a chip is not removable', () => {
      it('stays editable but has no remove button', () => {
        render(<Harness initial={INITIAL} nonRemovableIds={['b']} />);
        const chip = screen.getByRole('group', { name: 'Trace ID is x' });
        expect(within(chip).getByRole('combobox', { name: 'Value: x' })).not.toBeNull();
        expect(within(chip).queryByRole('button', { name: /Remove/ })).toBeNull();
      });

      it('ignores Backspace and Delete', () => {
        const onChange = vi.fn();
        render(<Harness initial={INITIAL} nonRemovableIds={['b']} onChange={onChange} />);
        const value = screen.getByRole('combobox', { name: 'Value: x' });
        value.focus();
        fireEvent.keyDown(value, { key: 'Backspace' });
        fireEvent.keyDown(value, { key: 'Delete' });
        expect(onChange).not.toHaveBeenCalled();
        expect(getChips()).toHaveLength(INITIAL.length);
      });

      it('Clear keeps it and removes the others', () => {
        const onChange = vi.fn();
        render(<Harness initial={INITIAL} nonRemovableIds={['b']} onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
        expect(onChange).toHaveBeenCalledWith([INITIAL[1]]);
      });

      it('hides Clear when no other chip is removable', () => {
        render(<Harness initial={INITIAL.slice(1)} nonRemovableIds={['b']} />);
        expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
      });

      it('ArrowLeft from the next chip lands on its value segment', () => {
        render(<Harness initial={INITIAL} nonRemovableIds={['a']} />);
        const field = screen.getByRole('combobox', { name: 'Field: Trace ID' });
        field.focus();
        fireEvent.keyDown(field, { key: 'ArrowLeft' });
        expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Value: Running' }));
      });
    });

    describe('when a custom chip registers only a value segment', () => {
      function ValueOnlyChip({ item }: { item: FilterBarItem }) {
        const ctx = useFilterBarContext();
        return (
          <FilterBar.Chip item={item} removable={false}>
            <span>Time</span>
            <button
              type="button"
              data-filter-bar-segment=""
              aria-label="Value: Last 7 days"
              ref={el => ctx.registerSegment(item.id, 'value', el)}
            />
          </FilterBar.Chip>
        );
      }
      const TIME: FilterBarItem = { id: 'time', fieldId: 'time', operatorId: 'is', value: '' };
      const FIELDS_WITH_TIME: FilterBarField[] = [...FIELDS, { id: 'time', label: 'Time', operators: ['is'] }];

      function CustomHarness() {
        const [items, setItems] = useState<FilterBarItem[]>([TIME, ...INITIAL]);
        return (
          <FilterBar fields={FIELDS_WITH_TIME} operators={OPERATORS} value={items} onValueChange={setItems}>
            {items.map(item =>
              item.id === TIME.id ? (
                <ValueOnlyChip key={item.id} item={item} />
              ) : (
                <FilterBar.Chip key={item.id} item={item} />
              ),
            )}
            <FilterBar.Input placeholder="Filter…" />
          </FilterBar>
        );
      }

      it('ArrowLeft from the next chip focuses that value segment', () => {
        render(<CustomHarness />);
        const field = screen.getByRole('combobox', { name: 'Field: Status' });
        field.focus();
        fireEvent.keyDown(field, { key: 'ArrowLeft' });
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Value: Last 7 days' }));
      });
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
      await screen.findByRole('option', { name: 'Name' });
      expect(resolver).not.toHaveBeenCalled();
      key('Enter');

      // Base UI's Status live region appends an invisible marker to its text on mount.
      await screen.findByText(/Loading…/);
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
      await screen.findByText(/Couldn't load values./);
      type('manual');
      await screen.findByText(/Couldn't load values./);
      key('Enter');
      expect(argAt(onChange, 0, 0)[0]).toMatchObject({ value: 'manual' });
    });

    it('tolerates an inline resolver whose identity changes on every render', async () => {
      const calls: string[] = [];
      function Inline() {
        const [, rerender] = useState(0);
        const fields: FilterBarField[] = [
          {
            id: 'name',
            label: 'Name',
            operators: ['is'],
            suggestions: async ({ query }) => {
              calls.push(query);
              rerender(n => n + 1); // like a story/consumer logging calls into state
              return [{ value: 'alpha' }];
            },
          },
        ];
        return <Harness fields={fields} />;
      }
      render(<Inline />);
      getInput().focus();
      type('name');
      key('Enter');
      key('Enter');
      await screen.findByRole('option', { name: 'alpha' });
      expect(calls).toEqual(['']);
    });
  });

  describe('when a field is hidden', () => {
    const fields: FilterBarField[] = [
      { id: 'scope', label: 'Scope', operators: ['is'], hidden: true },
      { id: 'traceId', label: 'Trace ID', operators: ['is'] },
    ];

    it('does not list it in the field step', async () => {
      render(<Harness fields={fields} />);
      getInput().focus();
      await screen.findByRole('option', { name: 'Trace ID' });
      expect(screen.queryByRole('option', { name: 'Scope' })).toBeNull();
    });

    it('still labels an existing chip for it', () => {
      render(
        <Harness fields={fields} initial={[{ id: 'scope', fieldId: 'scope', operatorId: 'is', value: 'agent-1' }]} />,
      );
      expect(within(getChips()[0] as HTMLElement).getByText('Scope')).toBeTruthy();
    });
  });
});
