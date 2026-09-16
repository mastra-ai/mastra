import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { ListSearch } from './list-search';
import type { ListSearchProps } from './list-search';

const meta: Meta<typeof ListSearch> = {
  title: 'Forms/ListSearch',
  component: ListSearch,
  parameters: { layout: 'centered' },
  args: {
    label: 'Search agents',
    placeholder: 'Search by name or description',
    debounceMs: 300,
    onSearch: fn(),
    value: '',
    variant: 'outline',
  },
};

export default meta;
type Story = StoryObj<typeof ListSearch>;

function SearchPreview(props: ListSearchProps) {
  const [value, setValue] = useState(props.value ?? '');
  const [debouncedValue, setDebouncedValue] = useState(props.value ?? '');

  return (
    <div className="flex w-120 flex-col gap-3">
      <ListSearch
        {...props}
        value={value}
        onSearch={nextValue => {
          setValue(nextValue);
          setDebouncedValue(nextValue);
          props.onSearch(nextValue);
        }}
      />
      <p className="text-ui-sm text-neutral3">Debounced value: {debouncedValue || 'None'}</p>
    </div>
  );
}

export const Default: Story = {
  render: args => <SearchPreview {...args} />,
};

export const PresetValue: Story = {
  args: {
    value: 'research',
    debounceMs: 0,
    size: 'sm',
    variant: 'unstyled',
  },
  render: args => <SearchPreview {...args} />,
};
