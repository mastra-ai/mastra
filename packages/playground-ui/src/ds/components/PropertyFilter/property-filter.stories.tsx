import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { PickMultiPanel } from './pick-multi-panel';
import { PropertyFilterActions } from './property-filter-actions';
import { PropertyFilterApplied } from './property-filter-applied';
import { PropertyFilterCreator } from './property-filter-creator';
import type { PropertyFilterField, PropertyFilterToken } from './types';

const FIELDS: PropertyFilterField[] = [
  {
    id: 'status',
    label: 'Status',
    kind: 'pick-multi',
    searchable: false,
    options: [
      { label: 'Running', value: 'running' },
      { label: 'Success', value: 'success' },
      { label: 'Error', value: 'error' },
    ],
    emptyText: 'No statuses.',
  },
  {
    id: 'tags',
    label: 'Tags',
    kind: 'pick-multi',
    multi: true,
    options: [
      { label: 'production', value: 'production' },
      { label: 'staging', value: 'staging' },
      { label: 'experiment', value: 'experiment' },
      { label: 'regression', value: 'regression' },
    ],
    emptyText: 'No tags found.',
  },
  {
    id: 'environment',
    label: 'Environment',
    kind: 'pick-multi',
    options: [
      { label: 'prod', value: 'prod' },
      { label: 'staging', value: 'staging' },
      { label: 'dev', value: 'dev' },
    ],
    emptyText: 'No environments found.',
  },
  { id: 'traceId', label: 'Trace ID', kind: 'text' },
  { id: 'runId', label: 'Run ID', kind: 'text' },
];

const meta: Meta = {
  title: 'Composite/PropertyFilter',
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj;

function useTokens(initial: PropertyFilterToken[] = []) {
  const [tokens, setTokens] = useState<PropertyFilterToken[]>(initial);
  return { tokens, setTokens };
}

export const Creator: Story = {
  name: 'Creator — empty',
  render: () => {
    const { tokens, setTokens } = useTokens();
    return (
      <div className="flex items-center gap-2">
        <PropertyFilterCreator fields={FIELDS} tokens={tokens} onTokensChange={setTokens} />
        <span className="text-ui-sm text-neutral3">{tokens.length} token(s)</span>
      </div>
    );
  },
};

export const CreatorLoadingOptions: Story = {
  name: 'Creator — loading pick-multi options',
  render: () => {
    const { tokens, setTokens } = useTokens();
    const fields: PropertyFilterField[] = FIELDS.map(f =>
      f.kind === 'pick-multi' && f.id === 'tags' ? { ...f, options: [], isLoading: true } : f,
    );
    return <PropertyFilterCreator fields={fields} tokens={tokens} onTokensChange={setTokens} />;
  },
};

export const AppliedPills: Story = {
  name: 'Applied pills',
  render: () => {
    const { tokens, setTokens } = useTokens([
      { fieldId: 'status', value: 'success' },
      { fieldId: 'tags', value: ['production', 'regression'] },
      { fieldId: 'traceId', value: 'abc123' },
    ]);
    return <PropertyFilterApplied fields={FIELDS} tokens={tokens} onTokensChange={setTokens} />;
  },
};

export const Actions: Story = {
  name: 'Actions — full menu',
  render: () => (
    <PropertyFilterActions
      onClear={() => console.log('clear')}
      onRemoveAll={() => console.log('remove all')}
      onSave={() => console.log('save')}
      onRemoveSaved={() => console.log('remove saved')}
    />
  ),
};

export const ActionsWithoutReset: Story = {
  name: 'Actions — no Clear button',
  render: () => (
    <PropertyFilterActions
      onRemoveAll={() => console.log('remove all')}
      onSave={() => console.log('save')}
      onRemoveSaved={() => console.log('remove saved')}
    />
  ),
};

export const PickMultiPanelSingle: Story = {
  name: 'PickMultiPanel — single-select',
  render: () => {
    const field = FIELDS.find(f => f.id === 'status') as Extract<PropertyFilterField, { kind: 'pick-multi' }>;
    const { tokens, setTokens } = useTokens([{ fieldId: 'status', value: 'running' }]);
    return (
      <div className="w-64 rounded-md border border-border1 bg-surface3 p-2">
        <PickMultiPanel
          field={field}
          tokens={tokens}
          onChange={(fieldId, value) => {
            if (value === undefined) setTokens(prev => prev.filter(t => t.fieldId !== fieldId));
            else
              setTokens(prev => {
                const existing = prev.findIndex(t => t.fieldId === fieldId);
                if (existing === -1) return [...prev, { fieldId, value }];
                const next = [...prev];
                next[existing] = { fieldId, value };
                return next;
              });
          }}
        />
      </div>
    );
  },
};

export const PickMultiPanelMulti: Story = {
  name: 'PickMultiPanel — multi-select',
  render: () => {
    const field = FIELDS.find(f => f.id === 'tags') as Extract<PropertyFilterField, { kind: 'pick-multi' }>;
    const { tokens, setTokens } = useTokens([{ fieldId: 'tags', value: ['production'] }]);
    return (
      <div className="w-64 rounded-md border border-border1 bg-surface3 p-2">
        <PickMultiPanel
          field={field}
          tokens={tokens}
          onChange={(fieldId, value) => {
            const shouldRemove = value === undefined || (Array.isArray(value) && value.length === 0);
            if (shouldRemove) setTokens(prev => prev.filter(t => t.fieldId !== fieldId));
            else
              setTokens(prev => {
                const existing = prev.findIndex(t => t.fieldId === fieldId);
                if (existing === -1) return [...prev, { fieldId, value: value! }];
                const next = [...prev];
                next[existing] = { fieldId, value: value! };
                return next;
              });
          }}
        />
      </div>
    );
  },
};

export const PickMultiPanelLoading: Story = {
  name: 'PickMultiPanel — loading',
  render: () => {
    const field: PropertyFilterField = {
      id: 'tags',
      label: 'Tags',
      kind: 'pick-multi',
      multi: true,
      options: [],
      isLoading: true,
    };
    return (
      <div className="w-64 rounded-md border border-border1 bg-surface3 p-2">
        <PickMultiPanel field={field} tokens={[]} onChange={() => {}} />
      </div>
    );
  },
};

export const FullFilterBar: Story = {
  name: 'Full filter bar (Creator + Applied + Actions)',
  render: () => {
    const { tokens, setTokens } = useTokens([
      { fieldId: 'status', value: 'error' },
      { fieldId: 'environment', value: 'prod' },
      { fieldId: 'tags', value: ['production'] },
    ]);
    const hasNonDefaultFilter = tokens.some(t => {
      if (typeof t.value === 'string') return t.value.trim() !== '' && t.value !== 'Any';
      return Array.isArray(t.value) && t.value.length > 0;
    });
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <PropertyFilterCreator fields={FIELDS} tokens={tokens} onTokensChange={setTokens} />
          <PropertyFilterActions
            onClear={hasNonDefaultFilter ? () => setTokens([]) : undefined}
            onRemoveAll={() => setTokens([])}
            onSave={() => console.log('save')}
          />
        </div>
        <PropertyFilterApplied fields={FIELDS} tokens={tokens} onTokensChange={setTokens} />
      </div>
    );
  },
};
