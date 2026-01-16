import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelectField } from './select-field';

const meta: Meta<typeof SelectField> = {
  title: 'Elements/SelectField',
  component: SelectField,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: { type: 'boolean' },
    },
    required: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SelectField>;

const sampleOptions = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' },
  { value: 'option4', label: 'Option 4' },
];

const fruitOptions = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'orange', label: 'Orange' },
  { value: 'grape', label: 'Grape' },
  { value: 'strawberry', label: 'Strawberry' },
];

export const Default: Story = {
  args: {
    name: 'example',
    label: 'Select an Option',
    options: sampleOptions,
    placeholder: 'Choose an option...',
    onValueChange: (value: string) => console.log('Selected:', value),
  },
};

export const WithValue: Story = {
  args: {
    name: 'with-value',
    label: 'Select with Value',
    value: 'option2',
    options: sampleOptions,
    onValueChange: (value: string) => console.log('Selected:', value),
  },
};

export const Required: Story = {
  args: {
    name: 'required',
    label: 'Required Selection',
    required: true,
    options: sampleOptions,
    onValueChange: (value: string) => console.log('Selected:', value),
  },
};

export const WithHelpMessage: Story = {
  args: {
    name: 'help',
    label: 'Select with Help',
    helpMsg: 'This is a helpful message to guide the user',
    options: sampleOptions,
    onValueChange: (value: string) => console.log('Selected:', value),
  },
};

export const Disabled: Story = {
  args: {
    name: 'disabled',
    label: 'Disabled Select',
    value: 'option1',
    disabled: true,
    options: sampleOptions,
    onValueChange: (value: string) => console.log('Selected:', value),
  },
};

export const NoLabel: Story = {
  args: {
    name: 'no-label',
    options: sampleOptions,
    placeholder: 'No label select',
    onValueChange: (value: string) => console.log('Selected:', value),
  },
};

export const FruitSelector: Story = {
  args: {
    name: 'fruit',
    label: 'Select a Fruit',
    options: fruitOptions,
    placeholder: 'Choose your favorite fruit...',
    onValueChange: (value: string) => console.log('Selected fruit:', value),
  },
};

export const LongOptions: Story = {
  args: {
    name: 'long-options',
    label: 'Long Option List',
    options: Array.from({ length: 20 }, (_, i) => ({
      value: `option${i + 1}`,
      label: `This is a very long option label number ${i + 1} that might wrap to multiple lines`,
    })),
    onValueChange: (value: string) => console.log('Selected:', value),
  },
};
