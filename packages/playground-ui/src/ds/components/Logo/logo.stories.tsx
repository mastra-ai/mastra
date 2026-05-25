import type { Meta, StoryObj } from '@storybook/react-vite';

import { Logo } from './logo';

const meta: Meta<typeof Logo> = {
  title: 'Elements/Logo',
  component: Logo,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    size: {
      control: { type: 'radio' },
      options: ['sm', 'md'],
    },
    animateOnHover: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Logo>;

export const Default: Story = {
  args: {},
};

export const OutlineOnHover: Story = {
  args: { animateOnHover: true, size: 'md' },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-8">
      <Logo size="sm" animateOnHover />
      <Logo size="md" animateOnHover />
    </div>
  ),
};

export const OnSurface: Story = {
  render: () => (
    <div className="flex h-64 w-96 items-center justify-center rounded-lg bg-surface2">
      <Logo size="md" animateOnHover />
    </div>
  ),
};
