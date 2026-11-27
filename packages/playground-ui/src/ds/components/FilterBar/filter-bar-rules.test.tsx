// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_FILTER_OPERATORS } from './default-operators';
import { FilterBar } from './filter-bar';
import type { FilterBarProps } from './filter-bar';
import { isFilterBarGroup } from './types';
import type {
  FilterBarExpression,
  FilterBarField,
  FilterBarGroup,
  FilterBarItem,
  FilterBarNode,
  FilterBarScope,
} from './types';

afterEach(cleanup);

const FIELDS: FilterBarField[] = [
  {
    id: 'status',
    label: 'Status',
    operators: ['is', 'is-not', 'in', 'is-empty'],
    suggestions: [{ value: 'running' }, { value: 'success' }, { value: 'error' }],
  },
  { id: 'traceId', label: 'Trace ID', operators: ['is', 'contains'] },
];

type ExpressionChange = (expression: FilterBarExpression) => void;
type ListChange = (items: FilterBarItem[]) => void;

type RuleProps = Omit<FilterBarProps, 'fields' | 'operators' | 'value' | 'onValueChange' | 'children'>;

function ExpressionHarness({
  initial,
  onChange,
  fields = FIELDS,
  ...props
}: RuleProps & {
  initial: FilterBarExpression;
  onChange?: ExpressionChange;
  fields?: FilterBarField[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <FilterBar
      {...props}
      fields={fields}
      operators={DEFAULT_FILTER_OPERATORS}
      value={value}
      onValueChange={(next: typeof value) => {
        setValue(next);
        onChange?.(next);
      }}
    >
      <FilterBar.Chips />
      <FilterBar.Input placeholder="Filter" />
    </FilterBar>
  );
}

function ListHarness({ initial, onChange, ...props }: RuleProps & { initial: FilterBarItem[]; onChange?: ListChange }) {
  const [value, setValue] = useState(initial);
  return (
    <FilterBar
      {...props}
      fields={FIELDS}
      operators={DEFAULT_FILTER_OPERATORS}
      value={value}
      onValueChange={(next: typeof value) => {
        setValue(next);
        onChange?.(next);
      }}
    >
      <FilterBar.Chips />
      <FilterBar.Input placeholder="Filter" />
    </FilterBar>
  );
}

const status = (id = 'a', extra: Partial<FilterBarItem> = {}): FilterBarItem => ({
  id,
  fieldId: 'status',
  operatorId: 'is',
  value: 'error',
  ...extra,
});

const expressionOf = (...nodes: FilterBarExpression['nodes']): FilterBarExpression => ({ logic: 'and', nodes });

const lastValue = <T,>(mock: { mock: { calls: [T][] } }): T => {
  const call = mock.mock.calls.at(-1);
  if (!call) throw new Error('onChange was not called');
  return call[0];
};

const first = <T,>(items: readonly T[]): T => {
  const [item] = items;
  if (item === undefined) throw new Error('expected at least one element');
  return item;
};

const groupOf = (node: FilterBarNode | undefined): FilterBarGroup => {
  if (!node || !isFilterBarGroup(node)) throw new Error('expected a group');
  return node;
};

const getChip = (name: string | RegExp) => screen.getByRole('group', { name });

const getInput = () => screen.getByRole<HTMLInputElement>('combobox', { name: 'Add filter' });
const type = (text: string) => fireEvent.change(getInput(), { target: { value: text } });
const key = (k: string) => fireEvent.keyDown(getInput(), { key: k });

const openAdvanced = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Advanced filter/ }));
  // The root editor comes first; nested groups render their own editors inside it.
  return first(await screen.findAllByRole('group', { name: /^Conditions joined with/ }));
};

describe('FilterBar rules', () => {
  describe('negation', () => {
    describe('when the bar is not negatable', () => {
      it('offers no way to negate a condition', () => {
        render(<ExpressionHarness initial={expressionOf(status())} />);
        expect(screen.queryByRole('button', { name: /^Negate/ })).toBeNull();
      });
    });

    describe('when the bar is negatable', () => {
      it('negates a condition from its chip and reads it as "not"', () => {
        const onChange = vi.fn<ExpressionChange>();
        render(<ExpressionHarness negatable initial={expressionOf(status())} onChange={onChange} />);

        const toggle = screen.getByRole('button', { name: 'Negate Status is error' });
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        fireEvent.click(toggle);

        expect(lastValue(onChange)).toEqual(expressionOf(status('a', { negated: true })));
        expect(getChip(/^not Status is error/)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Negate Status is error' }).getAttribute('aria-pressed')).toBe(
          'true',
        );
      });

      it('drops the flag when the negation is turned off again', () => {
        const onChange = vi.fn<ExpressionChange>();
        render(
          <ExpressionHarness negatable initial={expressionOf(status('a', { negated: true }))} onChange={onChange} />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Negate Status is error' }));

        const next = lastValue(onChange);
        expect(next.nodes[0]).toEqual(status());
        expect(next.nodes[0]).not.toHaveProperty('negated');
      });

      it('keeps the negation on a flat list of filters', () => {
        const onChange = vi.fn<ListChange>();
        render(<ListHarness negatable initial={[status()]} onChange={onChange} />);

        fireEvent.click(screen.getByRole('button', { name: 'Negate Status is error' }));

        expect(lastValue(onChange)).toEqual([status('a', { negated: true })]);
      });

      it('reaches the negation with the arrow keys, before the field', () => {
        render(<ExpressionHarness negatable initial={expressionOf(status())} />);
        const chip = getChip(/Status is error/);
        const field = within(chip).getByRole('combobox', { name: /field/i });

        field.focus();
        fireEvent.keyDown(field, { key: 'ArrowLeft' });

        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Negate Status is error' }));
      });

      it('does not offer it on the chip still being built', () => {
        render(<ExpressionHarness negatable initial={expressionOf()} />);
        const input = screen.getByRole('combobox', { name: 'Add filter' });

        fireEvent.change(input, { target: { value: 'Status' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(document.querySelector('[data-slot="filter-bar-chip"][data-draft]')).toBeTruthy();
        expect(screen.queryByRole('button', { name: /^Negate/ })).toBeNull();
      });

      it('shows a negated condition as read only without a toggle', () => {
        render(
          <FilterBar
            negatable
            fields={FIELDS}
            operators={DEFAULT_FILTER_OPERATORS}
            value={expressionOf(status('a', { negated: true }))}
            onValueChange={() => {}}
          >
            <FilterBar.Chips renderChip={item => <FilterBar.Chip item={item} readOnly />} />
          </FilterBar>,
        );

        expect(getChip(/^not Status is error/)).toBeTruthy();
        expect(screen.queryByRole('button', { name: /^Negate/ })).toBeNull();
      });

      describe('of a group', () => {
        const GROUP = expressionOf({
          id: 'g',
          kind: 'group',
          logic: 'or',
          nodes: [status('b'), { id: 'c', fieldId: 'traceId', operatorId: 'is', value: 'abc' }],
        });

        it('negates the whole group from its editor', async () => {
          const onChange = vi.fn<ExpressionChange>();
          render(<ExpressionHarness negatable initial={GROUP} onChange={onChange} />);
          const editor = await openAdvanced();

          const toggle = first(within(editor).getAllByRole('button', { name: 'Negate group' }));
          fireEvent.click(toggle);

          const next = lastValue(onChange);
          expect(next.nodes[0]).toMatchObject({ id: 'g', negated: true });
          expect(screen.getByRole('group', { name: /^Advanced filter, not, 2 conditions/ })).toBeTruthy();
        });

        it('negates a nested group without touching its parent', async () => {
          const onChange = vi.fn<ExpressionChange>();
          const nested = expressionOf({
            id: 'g',
            kind: 'group',
            logic: 'and',
            nodes: [status('b'), { id: 'n', kind: 'group', logic: 'or', nodes: [status('c')] }],
          });
          render(<ExpressionHarness negatable initial={nested} onChange={onChange} />);
          await openAdvanced();

          const card = screen.getByRole('group', { name: /^Conditions joined with or/ });
          fireEvent.click(within(card).getByRole('button', { name: 'Negate group' }));

          const next = lastValue(onChange);
          const root = groupOf(next.nodes[0]);
          expect(root).not.toHaveProperty('negated');
          expect(root.nodes[1]).toMatchObject({ id: 'n', negated: true });
        });

        it('offers no group negation when the bar is not negatable', async () => {
          render(<ExpressionHarness initial={GROUP} />);
          const editor = await openAdvanced();
          expect(within(editor).queryByRole('button', { name: 'Negate group' })).toBeNull();
        });
      });
    });
  });

  describe('custom field', () => {
    const METADATA = { prefix: 'metadata.', field: { operators: ['is', 'is-not'] } };

    describe('when the bar takes no custom field', () => {
      it('offers nothing for a name outside the list', async () => {
        render(<ExpressionHarness initial={expressionOf()} />);
        getInput().focus();
        type('region');
        expect(await screen.findByText('No matching field.')).toBeTruthy();
      });
    });

    describe('when the bar takes a custom field', () => {
      it('offers the typed name under the prefix and filters on it', async () => {
        const onChange = vi.fn<ExpressionChange>();
        render(<ExpressionHarness customField={METADATA} initial={expressionOf()} onChange={onChange} />);
        getInput().focus();
        type('region');
        await screen.findByRole('option', { name: /metadata\.region/ });
        key('Enter');

        await screen.findByRole('option', { name: 'is not' });
        expect(screen.queryByRole('option', { name: 'contains' })).toBeNull();
        key('Enter');
        type('eu');
        key('Enter');

        expect(lastValue(onChange).nodes[0]).toMatchObject({
          fieldId: 'metadata.region',
          operatorId: 'is',
          value: 'eu',
        });
        expect(getChip(/metadata\.region is eu/)).toBeTruthy();
      });

      it('does not repeat the prefix when it is typed', async () => {
        render(<ExpressionHarness customField={METADATA} initial={expressionOf()} />);
        getInput().focus();
        type('metadata.region');
        expect(await screen.findByRole('option', { name: /metadata\.region/ })).toBeTruthy();
        expect(screen.queryByRole('option', { name: /metadata\.metadata/ })).toBeNull();
      });

      it('keeps listed fields first and offers nothing for an empty name', async () => {
        render(<ExpressionHarness customField={METADATA} initial={expressionOf()} />);
        getInput().focus();
        type('status');
        const options = await screen.findAllByRole('option');
        expect(options[0]?.textContent).toContain('Status');
        expect(options.at(-1)?.textContent).toContain('metadata.status');

        type('metadata.');
        expect(screen.queryByRole('option', { name: /^metadata\.$/ })).toBeNull();
      });

      describe('whose template is root-only', () => {
        const rootOnly = { prefix: 'metadata.', field: { ...METADATA.field, rootOnly: true } };

        it('offers it at the root', async () => {
          render(<ExpressionHarness customField={rootOnly} initial={expressionOf()} />);
          getInput().focus();
          type('region');
          expect(await screen.findByRole('option', { name: /metadata\.region/ })).toBeTruthy();
        });

        it('does not offer it inside a group', async () => {
          render(
            <ExpressionHarness
              customField={rootOnly}
              initial={expressionOf({ id: 'g', kind: 'group', logic: 'or', nodes: [status('b')] })}
            />,
          );
          const editor = await openAdvanced();
          fireEvent.click(within(editor).getByRole('button', { name: 'Condition' }));
          const input = await within(editor).findByRole('combobox', { name: 'Add filter' });
          fireEvent.change(input, { target: { value: 'region' } });
          await screen.findByText('No matching field.');
          expect(screen.queryByRole('option', { name: /metadata\.region/ })).toBeNull();
        });

        it('does not offer it from the field segment of a chip inside a group', async () => {
          render(
            <ExpressionHarness
              customField={rootOnly}
              initial={expressionOf({ id: 'g', kind: 'group', logic: 'or', nodes: [status('b')] })}
            />,
          );
          await openAdvanced();
          fireEvent.click(screen.getByRole('combobox', { name: /^Field:/ }));
          fireEvent.change(await screen.findByPlaceholderText('Change field'), { target: { value: 'region' } });
          await screen.findByText('No matching field.');
          expect(screen.queryByRole('option', { name: /metadata\.region/ })).toBeNull();
        });
      });

      it('reads a chip on a custom field with the template operators', async () => {
        render(
          <ExpressionHarness
            customField={METADATA}
            initial={expressionOf({ id: 'm', fieldId: 'metadata.region', operatorId: 'is-not', value: 'eu' })}
          />,
        );
        expect(getChip(/metadata\.region is not eu/)).toBeTruthy();

        fireEvent.click(screen.getByRole('combobox', { name: /^Operator:/ }));
        await screen.findByRole('option', { name: 'is' });
        expect(screen.queryByRole('option', { name: 'contains' })).toBeNull();
      });

      it('changes a chip to a custom field from its field segment', async () => {
        const onChange = vi.fn<ExpressionChange>();
        render(<ExpressionHarness customField={METADATA} initial={expressionOf(status())} onChange={onChange} />);

        fireEvent.click(screen.getByRole('combobox', { name: /^Field:/ }));
        fireEvent.change(await screen.findByPlaceholderText('Change field'), { target: { value: 'region' } });
        fireEvent.click(await screen.findByRole('option', { name: /metadata\.region/ }));

        expect(lastValue(onChange).nodes[0]).toMatchObject({
          fieldId: 'metadata.region',
          operatorId: 'is',
        });
      });
    });
  });

  describe('item validation', () => {
    it('marks a chip invalid with the message the bar returns for it', () => {
      const validateItem = vi.fn((item: FilterBarItem) => (item.value === 'error' ? 'Pick another status' : undefined));
      render(
        <ExpressionHarness
          validateItem={validateItem}
          initial={expressionOf(status('a'), status('b', { value: 'success' }))}
        />,
      );

      const invalid = getChip(/Status is error/);
      expect(invalid.getAttribute('aria-invalid')).toBe('true');
      expect(invalid.getAttribute('aria-description')).toBe('Pick another status');
      expect(getChip(/Status is success/).hasAttribute('aria-invalid')).toBe(false);
    });

    it('tells the validator where the condition sits', async () => {
      const validateItem = vi.fn(() => undefined);
      render(
        <ExpressionHarness
          validateItem={validateItem}
          initial={expressionOf(status('a', { negated: true }), {
            id: 'g',
            kind: 'group',
            logic: 'or',
            negated: true,
            nodes: [status('b')],
          })}
        />,
      );
      await openAdvanced();

      expect(validateItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), { negated: true });
      expect(validateItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }), { groupId: 'g', negated: true });
    });

    it('revalidates a chip once it is negated', () => {
      render(
        <ExpressionHarness
          negatable
          validateItem={(_item, place) => (place.negated ? 'Cannot be negated' : undefined)}
          initial={expressionOf(status())}
        />,
      );
      expect(getChip(/Status is error/).hasAttribute('aria-invalid')).toBe(false);

      fireEvent.click(screen.getByRole('button', { name: /^Negate/ }));
      expect(getChip(/not Status is error/).getAttribute('aria-description')).toBe('Cannot be negated');
    });

    it('leaves the chip still being built alone', async () => {
      const validateItem = vi.fn(() => 'Never valid');
      render(<ExpressionHarness validateItem={validateItem} initial={expressionOf()} />);
      getInput().focus();
      type('trace');
      await screen.findByRole('option', { name: 'Trace ID' });
      key('Enter');

      const draft = document.querySelector('[data-slot="filter-bar-chip"][data-draft]');
      expect(draft?.hasAttribute('aria-invalid')).toBe(false);
      expect(validateItem).not.toHaveBeenCalled();
    });
  });

  describe('operators by place', () => {
    // Under a negation: no word match on the trace id, and nothing at all on the status.
    const operatorsFor: NonNullable<FilterBarProps['operatorsFor']> = (field, place) => {
      if (!place.negated) return undefined;
      return field.id === 'status' ? [] : ['is'];
    };
    const trace = (id: string, extra: Partial<FilterBarItem> = {}): FilterBarItem => ({
      id,
      fieldId: 'traceId',
      operatorId: 'is',
      value: 'abc',
      ...extra,
    });
    const negatedGroup = (...nodes: FilterBarItem[]): FilterBarExpression =>
      expressionOf({ id: 'g', kind: 'group', logic: 'and', negated: true, nodes });

    const addInEditor = async (editor: HTMLElement, text: string) => {
      fireEvent.click(within(editor).getByRole('button', { name: 'Condition' }));
      const input = await within(editor).findByRole('combobox', { name: 'Add filter' });
      fireEvent.change(input, { target: { value: text } });
      return input;
    };

    it('offers every operator where the bar allows them all', async () => {
      render(<ExpressionHarness operatorsFor={operatorsFor} initial={expressionOf()} />);
      getInput().focus();
      type('trace');
      await screen.findByRole('option', { name: 'Trace ID' });
      key('Enter');

      expect(await screen.findByRole('option', { name: 'contains' })).toBeTruthy();
    });

    it('narrows the operators of a condition added under a negation', async () => {
      render(<ExpressionHarness operatorsFor={operatorsFor} initial={negatedGroup(trace('b'))} />);
      const editor = await openAdvanced();
      const input = await addInEditor(editor, 'trace');
      await screen.findByRole('option', { name: 'Trace ID' });
      fireEvent.keyDown(input, { key: 'Enter' });

      // A single operator left is implied, so the step goes straight to the value.
      expect(screen.queryByRole('option', { name: 'contains' })).toBeNull();
      expect(document.querySelector('[data-slot="filter-bar-chip"][data-draft]')?.textContent).toContain('Trace ID');
    });

    it('leaves out a field with no operator left under a negation', async () => {
      render(<ExpressionHarness operatorsFor={operatorsFor} initial={negatedGroup(trace('b'))} />);
      const editor = await openAdvanced();
      const input = await addInEditor(editor, 'tra');
      await screen.findByRole('option', { name: 'Trace ID' });

      fireEvent.change(input, { target: { value: 'stat' } });
      expect(screen.queryByRole('option', { name: 'Status' })).toBeNull();
    });

    it('narrows the operators a negated chip can switch to', async () => {
      render(
        <ExpressionHarness
          negatable
          operatorsFor={operatorsFor}
          initial={expressionOf(trace('a', { negated: true, operatorId: 'is' }))}
        />,
      );

      fireEvent.click(screen.getByRole('combobox', { name: /^Operator:/ }));
      await screen.findByRole('option', { name: 'is' });
      expect(screen.queryByRole('option', { name: 'contains' })).toBeNull();
    });

    it('marks a chip whose operator is not allowed where it sits', () => {
      render(
        <ExpressionHarness
          negatable
          operatorsFor={operatorsFor}
          initial={expressionOf(trace('a', { operatorId: 'contains' }))}
        />,
      );
      expect(getChip(/Trace ID contains abc/).hasAttribute('aria-invalid')).toBe(false);

      fireEvent.click(screen.getByRole('button', { name: /^Negate/ }));

      const chip = getChip(/not Trace ID contains abc/);
      expect(chip.getAttribute('aria-invalid')).toBe('true');
      expect(chip.getAttribute('aria-description')).toBe('"contains" is not available here');
    });

    it('does not widen a chip into an operator its place rules out', async () => {
      // A negated chip may not read "is any of"; a second value replaces the first instead.
      const noInUnderNot: NonNullable<FilterBarProps['operatorsFor']> = (field, place) =>
        place.negated ? (field.operators ?? []).filter(id => id !== 'in') : undefined;
      const onChange = vi.fn<(expression: FilterBarExpression) => void>();
      render(
        <ExpressionHarness
          negatable
          createItemId={fieldId => fieldId}
          operatorsFor={noInUnderNot}
          initial={expressionOf({ id: 'status', fieldId: 'status', operatorId: 'is', value: 'running', negated: true })}
          onChange={onChange}
        />,
      );
      getInput().focus();
      type('status');
      key('Enter');
      await screen.findByRole('option', { name: 'is' });
      key('Enter');
      type('err');
      key('Enter');

      expect(lastValue(onChange).nodes).toEqual([
        { id: 'status', fieldId: 'status', operatorId: 'is', value: 'error', negated: true },
      ]);
    });

    it('asks again for each group a condition sits in', async () => {
      // Same negation and scope in both groups: only the group tells them apart.
      const byGroup: NonNullable<FilterBarProps['operatorsFor']> = (_field, place) =>
        place.groupId === 'strict' ? ['is'] : undefined;
      const nested = (id: string, value: string): FilterBarGroup => ({
        id,
        kind: 'group',
        logic: 'and',
        nodes: [trace(`${id}-item`, { operatorId: 'contains', value })],
      });
      render(
        <ExpressionHarness
          operatorsFor={byGroup}
          initial={expressionOf({
            id: 'g',
            kind: 'group',
            logic: 'and',
            nodes: [nested('loose', 'one'), nested('strict', 'two')],
          })}
        />,
      );
      await openAdvanced();

      expect(getChip(/Trace ID contains one/).hasAttribute('aria-invalid')).toBe(false);
      expect(getChip(/Trace ID contains two/).getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe('root logic', () => {
    const toggles = () => screen.queryAllByRole('button', { name: /^Joined with/ });

    it('keeps root conditions joined with and, without a toggle, by default', () => {
      render(<ExpressionHarness initial={expressionOf(status('a'), status('b', { value: 'running' }))} />);
      expect(toggles()).toHaveLength(0);
    });

    it('shows one toggle between each pair of root chips and switches the root to or', () => {
      const onChange = vi.fn<ExpressionChange>();
      render(
        <ExpressionHarness
          rootLogicToggle
          onChange={onChange}
          initial={expressionOf(status('a'), status('b', { value: 'running' }), status('c', { value: 'success' }))}
        />,
      );
      expect(toggles()).toHaveLength(2);

      fireEvent.click(first(toggles()));

      expect(lastValue(onChange).logic).toBe('or');
      expect(toggles().map(t => t.textContent)).toEqual(['or', 'or']);
    });

    it('reads the logic the value already has', () => {
      render(
        <ExpressionHarness
          rootLogicToggle
          initial={{ logic: 'or', nodes: [status('a'), status('b', { value: 'running' })] }}
        />,
      );
      expect(first(toggles()).getAttribute('aria-label')).toBe('Joined with or, switch to and');
    });

    it('shows no toggle for a single chip', () => {
      render(<ExpressionHarness rootLogicToggle initial={expressionOf(status('a'))} />);
      expect(toggles()).toHaveLength(0);
    });

    it('shows no toggle on a flat list, which has nowhere to keep the logic', () => {
      render(<ListHarness rootLogicToggle initial={[status('a'), status('b', { value: 'running' })]} />);
      expect(toggles()).toHaveLength(0);
    });
  });

  describe('scoped groups', () => {
    const QUANTIFIERS = [
      { id: 'some', label: 'Has' },
      { id: 'none', label: 'Has no' },
    ];
    const SCOPES: FilterBarScope[] = [
      {
        id: 'spans',
        label: 'spans',
        fields: [
          { id: 'name', label: 'Span name', operators: ['is', 'contains'] },
          // Same id as a bar field: inside the scope, the scope's own field wins.
          { id: 'status', label: 'Span status', operators: ['is'] },
        ],
        quantifiers: QUANTIFIERS,
      },
      {
        id: 'scores',
        label: 'scores',
        fields: [{ id: 'value', label: 'Score', type: 'number', operators: ['gt', 'lt'] }],
        quantifiers: QUANTIFIERS,
      },
    ];
    const spanName = (id = 's1'): FilterBarItem => ({ id, fieldId: 'name', operatorId: 'is', value: 'llm' });
    const spansGroup = (nodes: FilterBarExpression['nodes'], quantifierId = 'some'): FilterBarGroup => ({
      id: 'g',
      kind: 'group',
      logic: 'and',
      nodes,
      scope: { id: 'spans', quantifierId },
    });
    const orGroup = (nodes: FilterBarExpression['nodes'] = [status('a')]): FilterBarGroup => ({
      id: 'or',
      kind: 'group',
      logic: 'or',
      nodes,
    });
    const openScoped = async (name: RegExp) => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name.source}`) }));
      return first(await screen.findAllByRole('group', { name: /^Conditions joined with/ }));
    };
    const openFieldList = () => getInput().focus();

    it('offers no related conditions without scopes', async () => {
      render(<ExpressionHarness initial={expressionOf(orGroup())} />);
      openFieldList();
      await screen.findByRole('option', { name: 'Status' });
      expect(screen.queryByRole('option', { name: /^Has / })).toBeNull();
      key('Escape');

      const editor = await openAdvanced();
      expect(within(editor).queryByRole('button', { name: /Related/ })).toBeNull();
    });

    it('starts a related clause from the bar and edits it with the scope fields', async () => {
      const onChange = vi.fn<ExpressionChange>();
      render(<ExpressionHarness scopes={SCOPES} onChange={onChange} initial={expressionOf()} />);

      openFieldList();
      fireEvent.click(await screen.findByRole('option', { name: 'Has spans…' }));

      expect(lastValue(onChange).nodes[0]).toMatchObject({
        kind: 'group',
        scope: { id: 'spans', quantifierId: 'some' },
      });
      await screen.findByRole('group', { name: /^Conditions joined with/ });
      expect(getInput().dataset.target).toBe(first(lastValue(onChange).nodes).id);
      openFieldList();
      await screen.findByRole('option', { name: 'Span name' });
      expect(screen.queryByRole('option', { name: 'Trace ID' })).toBeNull();
    });

    it('reads a root related clause as one chip and its conditions with the scope labels', async () => {
      render(
        <ExpressionHarness scopes={SCOPES} initial={expressionOf(spansGroup([spanName(), { ...status('s2') }]))} />,
      );
      expect(screen.getByRole('group', { name: 'Has spans, 2 conditions' })).toBeTruthy();

      const editor = await openScoped(/Has spans/);
      expect(within(editor).getByRole('group', { name: /^Span name is llm/ })).toBeTruthy();
      expect(within(editor).getByRole('group', { name: /^Span status/ })).toBeTruthy();
    });

    it('switches the quantifier of a related clause', async () => {
      const onChange = vi.fn<ExpressionChange>();
      render(
        <ExpressionHarness scopes={SCOPES} onChange={onChange} initial={expressionOf(spansGroup([spanName()]))} />,
      );
      await openScoped(/Has spans/);

      fireEvent.click(screen.getByRole('radio', { name: 'Has no' }));

      expect(lastValue(onChange).nodes[0]).toMatchObject({ scope: { id: 'spans', quantifierId: 'none' } });
      expect(screen.getByRole('group', { name: 'Has no spans, 1 condition' })).toBeTruthy();
    });

    it('adds a related clause inside an advanced filter', async () => {
      const onChange = vi.fn<ExpressionChange>();
      render(<ExpressionHarness scopes={SCOPES} onChange={onChange} initial={expressionOf(orGroup())} />);
      const editor = await openAdvanced();

      fireEvent.click(within(editor).getByRole('button', { name: /Related/ }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'scores' }));

      const group = groupOf(lastValue(onChange).nodes[0]);
      expect(group.nodes[1]).toMatchObject({ kind: 'group', scope: { id: 'scores', quantifierId: 'some' } });
      expect(await screen.findByText('scores')).toBeTruthy();
    });

    it('does not nest a related clause inside another', async () => {
      render(<ExpressionHarness scopes={SCOPES} initial={expressionOf(spansGroup([spanName()]))} />);
      const editor = await openScoped(/Has spans/);
      expect(within(editor).queryByRole('button', { name: /Related/ })).toBeNull();
    });

    it('stops offering related clauses once the cap is reached', async () => {
      render(
        <ExpressionHarness
          scopes={SCOPES}
          maxScopedGroups={1}
          initial={expressionOf(spansGroup([spanName()]), orGroup())}
        />,
      );
      openFieldList();
      await screen.findByRole('option', { name: 'Status' });
      expect(screen.queryByRole('option', { name: /^Has / })).toBeNull();
      key('Escape');

      fireEvent.click(screen.getByRole('button', { name: /Advanced filter/ }));
      const related = await screen.findByRole('button', { name: /Related/ });
      expect(related.hasAttribute('disabled') || related.getAttribute('aria-disabled') === 'true').toBe(true);
    });

    it('tells operatorsFor which scope a condition reads', async () => {
      const operatorsFor = vi.fn(() => undefined);
      render(
        <ExpressionHarness
          scopes={SCOPES}
          operatorsFor={operatorsFor}
          initial={expressionOf(spansGroup([spanName()], 'none'))}
        />,
      );
      await openScoped(/Has no spans/);
      expect(operatorsFor).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'name' }),
        expect.objectContaining({ groupId: 'g', scope: { id: 'spans', quantifierId: 'none' } }),
      );
    });
  });
});
