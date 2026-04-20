import type { Meta, StoryObj } from '@storybook/react-vite';

import { BrandLoader } from './brand-loader';

const meta: Meta<typeof BrandLoader> = {
  title: 'Elements/BrandLoader',
  component: BrandLoader,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'radio' },
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof BrandLoader>;

export const Default: Story = {
  args: {},
};

export const Small: Story = {
  args: { size: 'sm' },
};

export const Medium: Story = {
  args: { size: 'md' },
};

export const Large: Story = {
  args: { size: 'lg' },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-8">
      <BrandLoader size="sm" />
      <BrandLoader size="md" />
      <BrandLoader size="lg" />
    </div>
  ),
};

export const OnSurface: Story = {
  render: () => (
    <div className="flex h-64 w-96 items-center justify-center rounded-lg bg-surface2">
      <BrandLoader size="lg" />
    </div>
  ),
};
