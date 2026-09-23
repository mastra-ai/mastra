import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CircleIcon,
  GlobeIcon,
  HashIcon,
  PlayIcon,
  SearchIcon,
  TagIcon,
  TimerIcon,
  TriangleAlertIcon,
  UserIcon,
} from 'lucide-react';
import { useState } from 'react';
import { userEvent, within } from 'storybook/test';
import { DEFAULT_FILTER_OPERATORS } from './default-operators';
import { FilterBar } from './filter-bar';
import type { FilterBarExpression, FilterBarField, FilterBarItem } from './types';
import { Avatar } from '@/ds/components/Avatar/Avatar';
import { Txt } from '@/ds/components/Txt';
import { themedHueColor } from '@/lib/colors';

const FIELDS: FilterBarField[] = [
  {
    id: 'status',
    label: 'Status',
    icon: CircleIcon,
    color: themedHueColor(0),
    operators: ['is', 'is-not', 'in', 'is-empty', 'is-not-empty'],
    suggestions: [
      { value: 'running', label: 'Running' },
      { value: 'success', label: 'Success' },
      { value: 'error', label: 'Error' },
    ],
  },
  {
    id: 'environment',
    label: 'Environment',
    icon: GlobeIcon,
    color: themedHueColor(120),
    operators: ['is', 'is-not', 'in'],
    suggestions: [{ value: 'prod' }, { value: 'staging' }, { value: 'dev' }],
  },
  {
    id: 'tags',
    label: 'Tags',
    icon: TagIcon,
    color: themedHueColor(280),
    operators: ['in'],
    strict: true,
    suggestions: [{ value: 'production' }, { value: 'experiment' }, { value: 'regression' }, { value: 'canary' }],
  },
  {
    id: 'traceId',
    label: 'Trace ID',
    icon: HashIcon,
    color: themedHueColor(220),
    operators: ['is', 'contains', 'starts-with'],
  },
  { id: 'runId', label: 'Run ID', icon: PlayIcon, color: themedHueColor(180), operators: ['is', 'contains'] },
  {
    id: 'duration',
    label: 'Duration (ms)',
    icon: TimerIcon,
    color: themedHueColor(40),
    type: 'number',
    operators: ['gt', 'gte', 'lt', 'lte'],
  },
  {
    id: 'hasError',
    label: 'Has error',
    icon: TriangleAlertIcon,
    color: themedHueColor(330),
    type: 'boolean',
    operators: ['is'],
  },
];

const meta: Meta = {
  title: 'Composite/FilterBar',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          'Braintrust-style filter bar. Type in the input to pick a **field → operator → value**; each committed filter becomes an inline chip whose segments open their own editor on click or Enter.',
          '',
          '**Keyboard**: `↑/↓` move the highlight, `Enter`/`Tab` pick, `Esc`/`Backspace` step back. Empty input: `←` focuses the last chip, `Backspace` removes it. On a chip: `←/→` move across segments and chips, `Enter` edits, `Delete` removes. Multi-value (`in`): `Enter` toggles, `Ctrl/⌘+Enter` or **Done** commits.',
          '',
          'Values are plain strings; the component has no business typing. `suggestions` can be a static list or a lazy resolver invoked only once the value step opens.',
          '',
          '**Groups**: pass a `FilterBarExpression` (`{ logic, nodes }`) instead of a flat array to get Linear-style filter groups — chips holding sub-chips joined with `and` / `or` — and connectors between top-level nodes. See *With groups*.',
        ].join('\n'),
      },
    },
  },
};

export default meta;
type Story = StoryObj;

function Demo({
  fields = FIELDS,
  initial = [],
  children,
}: {
  fields?: FilterBarField[];
  initial?: FilterBarItem[];
  children?: (items: FilterBarItem[]) => React.ReactNode;
}) {
  const [items, setItems] = useState<FilterBarItem[]>(initial);
  return (
    <div className="grid w-full max-w-3xl gap-3">
      <FilterBar fields={fields} operators={DEFAULT_FILTER_OPERATORS} value={items} onValueChange={setItems}>
        <FilterBar.Chips />
        <FilterBar.Input placeholder="Filter traces…" />
      </FilterBar>
      {children?.(items)}
      <pre className="rounded-lg bg-card p-3 text-meta text-muted-foreground">{JSON.stringify(items, null, 2)}</pre>
    </div>
  );
}

export const Default: Story = {
  render: () => <Demo />,
};

export const WithPrefilledFilters: Story = {
  render: () => (
    <Demo
      initial={[
        { id: '1', fieldId: 'status', operatorId: 'is', value: 'error' },
        { id: '2', fieldId: 'tags', operatorId: 'in', value: ['production', 'canary'] },
        { id: '3', fieldId: 'duration', operatorId: 'gt', value: '1500' },
        { id: '4', fieldId: 'traceId', operatorId: 'is-empty', value: '' },
      ]}
    />
  ),
};

const TEAMMATES = [
  { id: 'github:ada', name: 'Ada' },
  { id: 'github:grace', name: 'Grace' },
  { id: 'github:linus', name: 'Linus' },
];

export const FreeText: Story = {
  name: 'Free text (search field) and option avatars',
  render: function FreeTextStory() {
    const fields: FilterBarField[] = [
      { id: 'text', label: 'Text', icon: SearchIcon, search: true, operators: ['contains'] },
      {
        id: 'teammate',
        label: 'Teammate',
        icon: UserIcon,
        color: themedHueColor(200),
        operators: ['is'],
        strict: true,
        suggestions: TEAMMATES.map(teammate => ({
          value: teammate.id,
          label: teammate.name,
          start: <Avatar name={teammate.name} />,
        })),
      },
      ...FIELDS,
    ];
    return <Demo fields={fields} />;
  },
};

const SLOW_MODELS = ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4', 'claude-opus-4', 'gemini-2.5-pro', 'llama-3.3-70b'];

export const LazyValues: Story = {
  name: 'Lazy values (fetched after the attribute is picked)',
  render: function LazyValuesStory() {
    const [calls, setCalls] = useState<string[]>([]);
    const fields: FilterBarField[] = [
      {
        id: 'model',
        label: 'Model',
        operators: ['is', 'is-not', 'in'],
        suggestions: async ({ query, operatorId, signal }) => {
          setCalls(c => [...c, `${operatorId} · "${query}"`]);
          await new Promise((resolve, reject) => {
            const t = setTimeout(resolve, 500);
            signal.addEventListener('abort', () => {
              clearTimeout(t);
              reject(new DOMException('aborted', 'AbortError'));
            });
          });
          return SLOW_MODELS.filter(m => m.includes(query.toLowerCase())).map(value => ({ value }));
        },
      },
      {
        id: 'agent',
        label: 'Agent',
        operators: ['is'],
        strict: true,
        suggestions: async () => {
          setCalls(c => [...c, 'agent (fails)']);
          await new Promise(r => setTimeout(r, 400));
          throw new Error('Network error');
        },
      },
      ...FIELDS,
    ];
    return (
      <Demo fields={fields}>
        {() => (
          <div className="rounded-lg border border-border p-3">
            <Txt variant="meta" tone="muted">
              Resolver calls ({calls.length}) — none until a field and operator are chosen:
            </Txt>
            <ul className="mt-1 text-caption text-foreground">
              {calls.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </Demo>
    );
  },
};

export const LockedChip: Story = {
  name: 'Locked chip (readOnly)',
  render: function LockedChipStory() {
    const [items, setItems] = useState<FilterBarItem[]>([
      { id: 'scope', fieldId: 'environment', operatorId: 'is', value: 'prod' },
      { id: '2', fieldId: 'status', operatorId: 'is', value: 'error' },
    ]);
    return (
      <FilterBar fields={FIELDS} operators={DEFAULT_FILTER_OPERATORS} value={items} onValueChange={setItems}>
        {items.map(item => (
          <FilterBar.Chip key={item.id} item={item} readOnly={item.id === 'scope'} />
        ))}
        <FilterBar.Input />
      </FilterBar>
    );
  },
};

export const CustomLayout: Story = {
  name: 'Custom layout (segments and actions)',
  render: function CustomLayoutStory() {
    const [items, setItems] = useState<FilterBarItem[]>([
      { id: '1', fieldId: 'status', operatorId: 'is-not', value: 'success' },
    ]);
    return (
      <div className="grid gap-2">
        <FilterBar
          fields={FIELDS}
          operators={DEFAULT_FILTER_OPERATORS}
          value={items}
          onValueChange={setItems}
          className="rounded-lg"
        >
          <FilterBar.Input placeholder="Add a filter…" />
        </FilterBar>
        <div className="flex flex-wrap items-center gap-1">
          {items.map(item => (
            <FilterBar.Chip key={item.id} item={item}>
              <FilterBar.Chip.Field />
              <FilterBar.Chip.Value />
              <FilterBar.Chip.Remove />
            </FilterBar.Chip>
          ))}
        </div>
      </div>
    );
  },
};

export const KeyboardOnly: Story = {
  name: 'Keyboard-only walkthrough (play)',
  render: () => <Demo />,
  play: async ({ canvasElement }) => {
    // Small delay between keystrokes so popover steps have re-rendered before the next key.
    const user = userEvent.setup({ delay: 80 });
    const input = within(canvasElement).getByRole('combobox', { name: 'Add filter' });
    await user.click(input);
    // Status › is not › Error
    await user.type(input, 'stat');
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{Enter}');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    // Trace ID › contains › abc
    await user.type(input, 'trace');
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{Enter}');
    await user.type(input, 'abc');
    await user.keyboard('{Enter}');
    // Walk back into the chips (remove button, then value), open the last value editor, close it, then remove that chip.
    await user.keyboard('{ArrowLeft}');
    await user.keyboard('{ArrowLeft}');
    await user.keyboard('{Enter}');
    await user.keyboard('{Escape}');
    await user.keyboard('{Backspace}');
  },
};

function ExpressionDemo({ initial }: { initial: FilterBarExpression }) {
  const [expression, setExpression] = useState<FilterBarExpression>(initial);
  return (
    <div className="grid w-full max-w-3xl gap-3">
      <FilterBar fields={FIELDS} operators={DEFAULT_FILTER_OPERATORS} value={expression} onValueChange={setExpression}>
        <FilterBar.Chips />
        <FilterBar.Input placeholder="Filter traces…" />
      </FilterBar>
      <pre className="rounded-lg bg-card p-3 text-meta text-muted-foreground">
        {JSON.stringify(expression, null, 2)}
      </pre>
    </div>
  );
}

export const WithAdvancedFilter: Story = {
  name: 'With an advanced filter (popover)',
  parameters: {
    docs: {
      description: {
        story:
          'Pass a `FilterBarExpression` as `value` to enable Linear-style advanced filters. Root chips are implicitly joined with `and`; every root-level group renders as one **Advanced filter** chip whose popover holds a recursive rule builder (rows, `and` / `or` connector, `+ Filter`, `+ Group`). Empty groups are pruned when the popover closes.',
      },
    },
  },
  render: () => (
    <ExpressionDemo
      initial={{
        logic: 'and',
        nodes: [
          { id: '1', fieldId: 'status', operatorId: 'is', value: 'error' },
          {
            id: 'g1',
            kind: 'group',
            logic: 'or',
            nodes: [
              { id: '2', fieldId: 'environment', operatorId: 'is', value: 'prod' },
              {
                id: 'g2',
                kind: 'group',
                logic: 'and',
                nodes: [
                  { id: '3', fieldId: 'environment', operatorId: 'is', value: 'staging' },
                  { id: '4', fieldId: 'duration', operatorId: 'gt', value: '1500' },
                ],
              },
            ],
          },
        ],
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const user = userEvent.setup({ delay: 80 });
    await user.click(within(canvasElement).getByRole('button', { name: /Advanced filter/ }));
  },
};

export const BuildAdvancedFilterFromKeyboard: Story = {
  name: 'Build an advanced filter from the keyboard (play)',
  render: () => <ExpressionDemo initial={{ logic: 'and', nodes: [] }} />,
  play: async ({ canvasElement }) => {
    const user = userEvent.setup({ delay: 80 });
    const body = within(document.body);
    const input = within(canvasElement).getByRole('combobox', { name: 'Add filter' });
    await user.click(input);
    // Status › is › Error
    await user.type(input, 'stat');
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    // Open an advanced filter; the popover input is now the active one.
    await user.type(input, 'advanced');
    await user.keyboard('{Enter}');
    const popoverInput = await body.findByRole('combobox', { name: 'Add filter' });
    // Environment is prod, Environment is staging
    await user.type(popoverInput, 'env');
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    await user.type(popoverInput, 'env');
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{Enter}');
    // Flip the connector, then nest a group and close the popover.
    await user.click(body.getByRole('button', { name: 'Joined with or, switch to and' }));
    await user.keyboard('{Escape}');
    await user.click(body.getByRole('button', { name: 'Group' }));
    await user.keyboard('{Escape}');
    await user.keyboard('{Escape}');
  },
};
