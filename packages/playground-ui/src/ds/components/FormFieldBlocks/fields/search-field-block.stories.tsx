import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SearchFieldBlock, type SearchFieldBlockProps } from './search-field-block';

function SearchFieldBlockControlled(props: SearchFieldBlockProps) {
  const [value, setValue] = useState(props.value ?? '');
  return (
    <SearchFieldBlock {...props} value={value} onChange={e => setValue(e.target.value)} onReset={() => setValue('')} />
  );
}

const meta: Meta<typeof SearchFieldBlock> = {
  title: 'FormFieldBlocks/SearchFieldBlock',
  component: SearchFieldBlock,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['small', 'default'],
    },
    layout: {
      control: { type: 'select' },
      options: ['vertical', 'horizontal'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
    required: {
      control: { type: 'boolean' },
    },
    labelIsHidden: {
      control: { type: 'boolean' },
    },
    error: {
      control: { type: 'boolean' },
    },
  },
  decorators: [
    Story => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
  render: args => <SearchFieldBlockControlled {...args} />,
};

export default meta;
type Story = StoryObj<typeof SearchFieldBlock>;

export const Default: Story = {
  args: {
    name: 'search',
    label: 'Search',
  },
};

export const WithPlaceholder: Story = {
  args: {
    name: 'search',
    label: 'Search',
    placeholder: 'Search items...',
  },
};

export const WithValue: Story = {
  args: {
    name: 'search',
    label: 'Search',
    value: 'example query',
  },
};

export const WithHelpText: Story = {
  args: {
    name: 'search',
    label: 'Search',
    helpText: 'Type to filter results.',
  },
};

export const WithError: Story = {
  args: {
    name: 'search',
    label: 'Search',
    error: true,
    errorMsg: 'No results found.',
  },
};

export const Disabled: Story = {
  args: {
    name: 'search',
    label: 'Search',
    value: 'locked query',
    disabled: true,
  },
};

export const HiddenLabel: Story = {
  args: {
    name: 'search',
    label: 'Search',
    labelIsHidden: true,
  },
};

export const HorizontalLayout: Story = {
  args: {
    name: 'search',
    label: 'Search',
    layout: 'horizontal',
  },
};
