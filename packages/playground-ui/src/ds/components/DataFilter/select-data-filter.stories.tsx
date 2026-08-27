import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { SelectDataFilter } from './select-data-filter';
import type { SelectDataFilterCategory, SelectDataFilterProps, SelectDataFilterState } from './select-data-filter';

const categories = [
  {
    id: 'status',
    label: 'Status',
    mode: 'multi',
    values: [
      { value: 'running', label: 'Running' },
      { value: 'completed', label: 'Completed' },
      { value: 'failed', label: 'Failed' },
    ],
  },
  {
    id: 'environment',
    label: 'Environment',
    mode: 'single',
    values: [
      { value: 'production', label: 'Production' },
      { value: 'staging', label: 'Staging' },
      { value: 'development', label: 'Development' },
    ],
  },
  {
    id: 'agent',
    label: 'Agent',
    group: 'Resources',
    values: [
      { value: 'research', label: 'Research agent' },
      { value: 'support', label: 'Customer support agent' },
      { value: 'sales', label: 'Sales qualification agent' },
      { value: 'writing', label: 'Writing agent' },
      { value: 'translation', label: 'Translation agent' },
      { value: 'analysis', label: 'Data analysis agent' },
    ],
  },
  {
    id: 'workflow',
    label: 'Workflow',
    group: 'Resources',
    values: [
      { value: 'daily-report', label: 'Daily report' },
      { value: 'lead-enrichment', label: 'Lead enrichment' },
    ],
  },
] satisfies SelectDataFilterCategory[];

const meta: Meta<typeof SelectDataFilter> = {
  title: 'Forms/SelectDataFilter',
  component: SelectDataFilter,
  parameters: { layout: 'centered' },
  args: {
    categories,
    value: {},
    onChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SelectDataFilter>;

function FilterPreview(props: SelectDataFilterProps) {
  const [value, setValue] = useState<SelectDataFilterState>(props.value);

  return (
    <div className="flex min-h-64 w-120 flex-col items-start gap-4">
      <SelectDataFilter
        {...props}
        value={value}
        onChange={nextValue => {
          setValue(nextValue);
          props.onChange(nextValue);
        }}
      />
      <pre className="border-border1 bg-surface2 text-ui-sm text-neutral4 w-full rounded-lg border p-4">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export const Default: Story = {
  render: args => <FilterPreview {...args} />,
};

export const WithActiveFilters: Story = {
  args: {
    value: {
      status: ['running', 'failed'],
      environment: ['production'],
    },
  },
  render: args => <FilterPreview {...args} />,
};

export const Disabled: Story = {
  args: { disabled: true },
  render: args => <FilterPreview {...args} />,
};
