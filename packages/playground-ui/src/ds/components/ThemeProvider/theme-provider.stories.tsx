import type { Meta, StoryObj } from '@storybook/react-vite';

import { ThemeToggle } from '../ThemeToggle';
import { ThemeProvider, useTheme } from './theme-provider';

const meta: Meta<typeof ThemeProvider> = {
  title: 'Providers/ThemeProvider',
  component: ThemeProvider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ThemeProvider>;

const Inspector = () => {
  const { theme, resolvedTheme, systemTheme } = useTheme();
  return (
    <div className="grid gap-3 rounded-lg border border-border1 bg-surface3 p-4 text-sm text-icon6">
      <div className="grid grid-cols-[120px_1fr] gap-2">
        <span className="text-icon3">theme</span>
        <span className="font-mono">{theme}</span>
        <span className="text-icon3">resolvedTheme</span>
        <span className="font-mono">{resolvedTheme}</span>
        <span className="text-icon3">systemTheme</span>
        <span className="font-mono">{systemTheme}</span>
      </div>
      <ThemeToggle />
    </div>
  );
};

export const Default: Story = {
  render: () => (
    <ThemeProvider storageKey="storybook-theme">
      <Inspector />
    </ThemeProvider>
  ),
};

export const WithCustomKey: Story = {
  render: () => (
    <ThemeProvider storageKey="storybook-theme-custom">
      <Inspector />
    </ThemeProvider>
  ),
};
