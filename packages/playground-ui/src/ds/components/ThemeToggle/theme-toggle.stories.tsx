import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { ThemeProvider } from '../ThemeProvider';
import type { Theme } from '../ThemeProvider';
import { ThemeToggle } from './theme-toggle';

const meta: Meta<typeof ThemeToggle> = {
  title: 'Elements/ThemeToggle',
  component: ThemeToggle,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ThemeToggle>;

export const Default: Story = {
  args: {
    size: 'md',
  },
  decorators: [
    Story => (
      <ThemeProvider storageKey="storybook-theme">
        <Story />
      </ThemeProvider>
    ),
  ],
};

export const ExtraSmall: Story = {
  args: {
    size: 'xs',
  },
  decorators: [
    Story => (
      <ThemeProvider storageKey="storybook-theme-extra-small">
        <Story />
      </ThemeProvider>
    ),
  ],
};

export const Small: Story = {
  args: {
    size: 'sm',
  },
  decorators: [
    Story => (
      <ThemeProvider storageKey="storybook-theme-small">
        <Story />
      </ThemeProvider>
    ),
  ],
};

export const Sizes: Story = {
  decorators: [
    Story => (
      <ThemeProvider storageKey="storybook-theme-sizes">
        <Story />
      </ThemeProvider>
    ),
  ],
  render: () => (
    <div className="flex items-center gap-4">
      <ThemeToggle size="xs" />
      <ThemeToggle size="sm" />
      <ThemeToggle size="md" />
    </div>
  ),
};

export const Controlled: Story = {
  render: args => {
    const [value, setValue] = useState<Theme>('system');
    return <ThemeToggle {...args} value={value} onChange={setValue} />;
  },
};
