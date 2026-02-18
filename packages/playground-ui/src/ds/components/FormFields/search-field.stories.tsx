import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchField } from './search-field';

const meta: Meta<typeof SearchField> = {
  title: 'Elements/FormFields/SearchField',
  component: SearchField,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    Story => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SearchField>;

export const Default: Story = {
  args: {
    name: 'search',
    label: 'Search',
    placeholder: 'Search items...',
    onReset: () => {},
  },
};

export const ComingExperimentalStyle: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="grid gap-3">
        <SearchField
          name="search"
          label="Search"
          placeholder="Search items..."
          value={value}
          onChange={e => setValue(e.target.value)}
          onReset={() => setValue('')}
        />
        <SearchField
          name="search"
          label="Search"
          placeholder="Search items..."
          value={value}
          onChange={e => setValue(e.target.value)}
          onReset={() => setValue('')}
          variant="new"
          size="default"
        />
      </div>
    );
  },
};

export const WithValue: Story = {
  args: {
    name: 'search',
    label: 'Search',
    value: 'dataset items',
  },
};

export const WithResetButton: Story = {
  render: () => {
    const [value, setValue] = useState('dataset items');
    return (
      <SearchField
        name="search"
        label="Search"
        placeholder="Search items..."
        value={value}
        onChange={e => setValue(e.target.value)}
        onReset={() => setValue('')}
      />
    );
  },
};

export const Empty: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <SearchField
        name="search"
        label="Search"
        placeholder="Search items..."
        value={value}
        onChange={e => setValue(e.target.value)}
        onReset={() => setValue('')}
      />
    );
  },
};

export const Disabled: Story = {
  args: {
    name: 'search',
    label: 'Search',
    placeholder: 'Search is disabled',
    disabled: true,
  },
};
