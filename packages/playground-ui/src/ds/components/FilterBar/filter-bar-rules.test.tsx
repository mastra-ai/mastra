// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_FILTER_OPERATORS } from './default-operators';
import { FilterBar } from './filter-bar';
import type { FilterBarProps } from './filter-bar';
import type { FilterBarExpression, FilterBarField, FilterBarGroup, FilterBarItem, FilterBarScope } from './types';

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

type RuleProps = Omit<FilterBarProps, 'fields' | 'operators' | 'value' | 'onValueChange' | 'children'>;

function ExpressionHarness({
  initial,
  onChange,
  fields = FIELDS,
  ...props
}: RuleProps & {
  initial: FilterBarExpression;
  onChange?: (expression: FilterBarExpression) => void;
  fields?: FilterBarField[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <FilterBar
      {...props}
      fields={fields}
      operators={DEFAULT_FILTER_OPERATORS}
      value={value}
      onValueChange={next => {
        setValue(next);
        onChange?.(next);
      }}
    >
      <FilterBar.Chips />
      <FilterBar.Input placeholder="Filter" />
    </FilterBar>
  );
}

function ListHarness({
  initial,
  onChange,
  ...props
}: RuleProps & { initial: FilterBarItem[]; onChange?: (items: FilterBarItem[]) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <FilterBar
      {...props}
      fields={FIELDS}
      operators={DEFAULT_FILTER_OPERATORS}
      value={value}
      onValueChange={next => {
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

const lastCall = <T,>(mock: { mock: { calls: T[][] } }) => mock.mock.calls.at(-1)?.[0];

const getChip = (name: string | RegExp) => screen.getByRole('group', { name });

const getInput = () => screen.getByRole('combobox', { name: 'Add filter' }) as HTMLInputElement;
const type = (text: string) => fireEvent.change(getInput(), { target: { value: text } });
const key = (k: string) => fireEvent.keyDown(getInput(), { key: k });

const openAdvanced = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Advanced filter/ }));
  // The root editor comes first; nested groups render their own editors inside it.
  return (await screen.findAllByRole('group', { name: /^Conditions joined with/ }))[0];
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
        const onChange = vi.fn();
        render(<ExpressionHarness negatable initial={expressionOf(status())} onChange={onChange} />);

        const toggle = screen.getByRole('button', { name: 'Negate Status is error' });
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        fireEvent.click(toggle);

        expect(lastCall(onChange)).toEqual(expressionOf(status('a', { negated: true })));
        expect(getChip(/^not Status is error/)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Negate Status is error' }).getAttribute('aria-pressed')).toBe(
          'true',
        );
      });

      it('drops the flag when the negation is turned off again', () => {
        const onChange = vi.fn();
        render(
          <ExpressionHarness negatable initial={expressionOf(status('a', { negated: true }))} onChange={onChange} />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Negate Status is error' }));

        const next = lastCall(onChange) as FilterBarExpression;
        expect(next.nodes[0]).toEqual(status());
        expect(next.nodes[0]).not.toHaveProperty('negated');
      });

      it('keeps the negation on a flat list of filters', () => {
        const onChange = vi.fn();
        render(<ListHarness negatable initial={[status()]} onChange={onChange} />);

        fireEvent.click(screen.getByRole('button', { name: 'Negate Status is error' }));

        expect(lastCall(onChange)).toEqual([status('a', { negated: true })]);
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
          const onChange = vi.fn();
          render(<ExpressionHarness negatable initial={GROUP} onChange={onChange} />);
          const editor = await openAdvanced();

          const toggle = within(editor).getAllByRole('button', { name: 'Negate group' })[0];
          fireEvent.click(toggle);

          const next = lastCall(onChange) as FilterBarExpression;
          expect(next.nodes[0]).toMatchObject({ id: 'g', negated: true });
          expect(screen.getByRole('group', { name: /^Advanced filter, not, 2 conditions/ })).toBeTruthy();
        });

        it('negates a nested group without touching its parent', async () => {
          const onChange = vi.fn();
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

          const next = lastCall(onChange) as FilterBarExpression;
          const root = next.nodes[0] as Extract<FilterBarExpression['nodes'][number], { kind: 'group' }>;
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
        const onChange = vi.fn();
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

        expect((lastCall(onChange) as FilterBarExpression).nodes[0]).toMatchObject({
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
        const onChange = vi.fn();
        render(<ExpressionHarness customField={METADATA} initial={expressionOf(status())} onChange={onChange} />);

        fireEvent.click(screen.getByRole('combobox', { name: /^Field:/ }));
        fireEvent.change(await screen.findByPlaceholderText('Change field'), { target: { value: 'region' } });
        fireEvent.click(await screen.findByRole('option', { name: /metadata\.region/ }));

        expect((lastCall(onChange) as FilterBarExpression).nodes[0]).toMatchObject({
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
  });

  describe('root logic', () => {
    const toggles = () => screen.queryAllByRole('button', { name: /^Joined with/ });

    it('keeps root conditions joined with and, without a toggle, by default', () => {
      render(<ExpressionHarness initial={expressionOf(status('a'), status('b', { value: 'running' }))} />);
      expect(toggles()).toHaveLength(0);
    });

    it('shows one toggle between each pair of root chips and switches the root to or', () => {
      const onChange = vi.fn();
      render(
        <ExpressionHarness
          rootLogicToggle
          onChange={onChange}
          initial={expressionOf(status('a'), status('b', { value: 'running' }), status('c', { value: 'success' }))}
        />,
      );
      expect(toggles()).toHaveLength(2);

      fireEvent.click(toggles()[0]);

      expect(lastCall(onChange)?.logic).toBe('or');
      expect(toggles().map(t => t.textContent)).toEqual(['or', 'or']);
    });

    it('reads the logic the value already has', () => {
      render(
        <ExpressionHarness
          rootLogicToggle
          initial={{ logic: 'or', nodes: [status('a'), status('b', { value: 'running' })] }}
        />,
      );
      expect(toggles()[0].getAttribute('aria-label')).toBe('Joined with or, switch to and');
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
      return (await screen.findAllByRole('group', { name: /^Conditions joined with/ }))[0];
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
      const onChange = vi.fn();
      render(<ExpressionHarness scopes={SCOPES} onChange={onChange} initial={expressionOf()} />);

      openFieldList();
      fireEvent.click(await screen.findByRole('option', { name: 'Has spans…' }));

      expect(lastCall(onChange)?.nodes[0]).toMatchObject({
        kind: 'group',
        scope: { id: 'spans', quantifierId: 'some' },
      });
      await screen.findByRole('group', { name: /^Conditions joined with/ });
      expect(getInput().dataset.target).toBe(lastCall(onChange)?.nodes[0].id);
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
      const onChange = vi.fn();
      render(
        <ExpressionHarness scopes={SCOPES} onChange={onChange} initial={expressionOf(spansGroup([spanName()]))} />,
      );
      await openScoped(/Has spans/);

      fireEvent.click(screen.getByRole('radio', { name: 'Has no' }));

      expect(lastCall(onChange)?.nodes[0]).toMatchObject({ scope: { id: 'spans', quantifierId: 'none' } });
      expect(screen.getByRole('group', { name: 'Has no spans, 1 condition' })).toBeTruthy();
    });

    it('adds a related clause inside an advanced filter', async () => {
      const onChange = vi.fn();
      render(<ExpressionHarness scopes={SCOPES} onChange={onChange} initial={expressionOf(orGroup())} />);
      const editor = await openAdvanced();

      fireEvent.click(within(editor).getByRole('button', { name: /Related/ }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'scores' }));

      const group = lastCall(onChange)?.nodes[0] as FilterBarGroup;
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
