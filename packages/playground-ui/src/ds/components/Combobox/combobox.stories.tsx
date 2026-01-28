import type { Meta, StoryObj } from '@storybook/react-vite';
import { Combobox } from './combobox';

const meta: Meta<typeof Combobox> = {
  title: 'Composite/Combobox',
  component: Combobox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: { type: 'boolean' },
    },
    variant: {
      control: { type: 'select' },
      options: ['default', 'light', 'outline', 'ghost'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Combobox>;

const frameworkOptions = [
  { label: 'React', value: 'react' },
  { label: 'Vue', value: 'vue' },
  { label: 'Angular', value: 'angular' },
  { label: 'Svelte', value: 'svelte' },
  { label: 'Next.js', value: 'nextjs' },
  { label: 'Nuxt', value: 'nuxt' },
];

const modelOptions = [
  { label: 'GPT-4', value: 'gpt-4' },
  { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
  { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
  { label: 'Claude 3 Opus', value: 'claude-3-opus' },
  { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet' },
  { label: 'Claude 3 Haiku', value: 'claude-3-haiku' },
];

export const Default: Story = {
  args: {
    options: frameworkOptions,
    placeholder: 'Select a framework...',
    className: 'w-[200px]',
  },
};

export const WithValue: Story = {
  args: {
    options: frameworkOptions,
    value: 'react',
    placeholder: 'Select a framework...',
    className: 'w-[200px]',
  },
};

export const ModelSelector: Story = {
  args: {
    options: modelOptions,
    placeholder: 'Select a model...',
    searchPlaceholder: 'Search models...',
    className: 'w-[220px]',
  },
};

export const Disabled: Story = {
  args: {
    options: frameworkOptions,
    placeholder: 'Select a framework...',
    disabled: true,
    className: 'w-[200px]',
  },
};

export const CustomEmptyText: Story = {
  args: {
    options: [],
    placeholder: 'Select an option...',
    emptyText: 'No options available',
    className: 'w-[200px]',
  },
};

export const LightVariant: Story = {
  args: {
    options: frameworkOptions,
    placeholder: 'Select a framework...',
    variant: 'light',
    className: 'w-[200px]',
  },
};

export const OutlineVariant: Story = {
  args: {
    options: frameworkOptions,
    placeholder: 'Select a framework...',
    variant: 'outline',
    className: 'w-[200px]',
  },
};

export const ManyOptions: Story = {
  args: {
    options: [
      { label: 'Option 1', value: '1' },
      { label: 'Option 2', value: '2' },
      { label: 'Option 3', value: '3' },
      { label: 'Option 4', value: '4' },
      { label: 'Option 5', value: '5' },
      { label: 'Option 6', value: '6' },
      { label: 'Option 7', value: '7' },
      { label: 'Option 8', value: '8' },
      { label: 'Option 9', value: '9' },
      { label: 'Option 10', value: '10' },
      { label: 'Option 11', value: '11' },
      { label: 'Option 12', value: '12' },
    ],
    placeholder: 'Select an option...',
    className: 'w-[200px]',
  },
};
