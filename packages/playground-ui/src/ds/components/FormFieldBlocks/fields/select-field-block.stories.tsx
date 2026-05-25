import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelectFieldBlock } from './select-field-block';

const sampleOptions = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'dragonfruit', label: 'Dragonfruit' },
];

const meta: Meta<typeof SelectFieldBlock> = {
  title: 'FormFieldBlocks/SelectFieldBlock',
  component: SelectFieldBlock,
  parameters: {
    layout: 'centered',
  },
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
  args: {
    options: sampleOptions,
    onValueChange: (value: string) => console.log('Selected:', value),
  },
  decorators: [
    Story => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SelectFieldBlock>;

export const Default: Story = {
  args: {
    name: 'fruit',
    label: 'Fruit',
  },
};

export const WithPlaceholder: Story = {
  args: {
    name: 'fruit',
    label: 'Fruit',
    placeholder: 'Pick a fruit...',
  },
};

export const WithHelpText: Story = {
  args: {
    name: 'fruit',
    label: 'Fruit',
    helpText: 'Choose your favourite fruit.',
  },
};

export const WithError: Story = {
  args: {
    name: 'fruit',
    label: 'Fruit',
    error: true,
    errorMsg: 'Selection is required.',
  },
};

export const Required: Story = {
  args: {
    name: 'fruit',
    label: 'Fruit',
    required: true,
  },
};

export const Disabled: Story = {
  args: {
    name: 'fruit',
    label: 'Fruit',
    value: 'banana',
    disabled: true,
  },
};

export const HiddenLabel: Story = {
  args: {
    name: 'fruit',
    label: 'Fruit',
    labelIsHidden: true,
  },
};

export const HorizontalLayout: Story = {
  args: {
    name: 'fruit',
    label: 'Fruit',
    layout: 'horizontal',
  },
};

export const SmallSize: Story = {
  args: {
    name: 'fruit',
    label: 'Fruit',
    size: 'sm',
  },
};

export const WithHelpTextAndError: Story = {
  args: {
    name: 'fruit',
    label: 'Fruit',
    helpText: 'Choose your favourite fruit.',
    error: true,
    errorMsg: 'Selection is required.',
  },
};
