import type { Meta, StoryObj } from '@storybook/react-vite';
import { ElementSelect } from './select';

const meta: Meta<typeof ElementSelect> = {
  title: 'Elements/ElementSelect',
  component: ElementSelect,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ElementSelect>;

export const Default: Story = {
  args: {
    name: 'select',
    placeholder: 'Select an option',
    options: ['Option 1', 'Option 2', 'Option 3'],
  },
};

export const WithValue: Story = {
  args: {
    name: 'select-value',
    value: 'Banana',
    options: ['Apple', 'Banana', 'Cherry'],
  },
};

export const CustomPlaceholder: Story = {
  args: {
    name: 'custom',
    placeholder: 'Choose a fruit...',
    options: ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'],
  },
};

export const FewOptions: Story = {
  args: {
    name: 'few',
    placeholder: 'Select',
    options: ['Yes', 'No'],
  },
};

export const ManyOptions: Story = {
  args: {
    name: 'many',
    placeholder: 'Select a color',
    options: ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet', 'Pink', 'Brown', 'Gray'],
  },
};
