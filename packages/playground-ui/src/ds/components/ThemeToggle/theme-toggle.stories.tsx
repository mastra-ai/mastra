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
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ThemeToggle>;

export const Default: Story = {
  decorators: [
    Story => (
      <ThemeProvider storageKey="storybook-theme">
        <Story />
      </ThemeProvider>
    ),
  ],
};

export const Controlled: Story = {
  render: args => {
    const [value, setValue] = useState<Theme>('system');
    return <ThemeToggle {...args} value={value} onChange={setValue} />;
  },
};
