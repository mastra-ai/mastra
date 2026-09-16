import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { userEvent, within } from 'storybook/test';
import { DEFAULT_FILTER_OPERATORS } from './default-operators';
import { FilterBar } from './filter-bar';
import type { FilterBarField, FilterBarItem } from './types';
import { Txt } from '@/ds/components/Txt';

const FIELDS: FilterBarField[] = [
  {
    id: 'status',
    label: 'Status',
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
    operators: ['is', 'is-not', 'in'],
    suggestions: [{ value: 'prod' }, { value: 'staging' }, { value: 'dev' }],
  },
  {
    id: 'tags',
    label: 'Tags',
    operators: ['in'],
    strict: true,
    suggestions: [{ value: 'production' }, { value: 'experiment' }, { value: 'regression' }, { value: 'canary' }],
  },
  { id: 'traceId', label: 'Trace ID', operators: ['is', 'contains', 'starts-with'] },
  { id: 'runId', label: 'Run ID', operators: ['is', 'contains'] },
  { id: 'duration', label: 'Duration (ms)', operators: ['gt', 'gte', 'lt', 'lte'] },
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
        <FilterBar.Clear />
      </FilterBar>
      {children?.(items)}
      <pre className="bg-surface3 text-ui-xs text-neutral4 rounded-lg p-3">{JSON.stringify(items, null, 2)}</pre>
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
          <div className="border-border1 rounded-lg border p-3">
            <Txt variant="ui-xs" className="text-neutral3">
              Resolver calls ({calls.length}) — none until a field and operator are chosen:
            </Txt>
            <ul className="text-ui-sm text-neutral5 mt-1">
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
        <FilterBar.Clear />
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
    // Walk back into the chips, open the last value editor, close it, then remove that chip.
    await user.keyboard('{ArrowLeft}');
    await user.keyboard('{Enter}');
    await user.keyboard('{Escape}');
    await user.keyboard('{Backspace}');
  },
};
