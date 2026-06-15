import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TooltipProvider } from '../../Tooltip';
import { SearchFieldBlock } from './search-field-block';
import type { SearchFieldBlockProps } from './search-field-block';

function SearchFieldBlockControlled(props: SearchFieldBlockProps) {
  const [value, setValue] = useState(props.value ?? '');
  const [isMinimized, setIsMinimized] = useState(props.isMinimized ?? false);
  return (
    <SearchFieldBlock
      {...props}
      value={value}
      onChange={e => setValue(e.target.value)}
      onReset={() => setValue('')}
      isMinimized={props.isMinimized !== undefined ? isMinimized : undefined}
      onMinimizedChange={props.isMinimized !== undefined ? setIsMinimized : undefined}
    />
  );
}

const meta: Meta<typeof SearchFieldBlock> = {
  title: 'FormFieldBlocks/SearchFieldBlock',
  component: SearchFieldBlock,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'default', 'lg'],
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
      <TooltipProvider>
        <div style={{ width: 320 }}>
          <Story />
        </div>
      </TooltipProvider>
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

export const Minimized: Story = {
  args: {
    name: 'search',
    label: 'Search',
    labelIsHidden: true,
    isMinimized: true,
    size: 'sm',
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="grid gap-6">
      <SearchFieldBlockControlled name="search-sm" label="Small" placeholder="Small size" size="sm" />
      <SearchFieldBlockControlled name="search-md" label="Medium" placeholder="Medium size" size="md" />
      <SearchFieldBlockControlled name="search-default" label="Default" placeholder="Default size" />
      <SearchFieldBlockControlled name="search-lg" label="Large" placeholder="Large size" size="lg" />
    </div>
  ),
};
