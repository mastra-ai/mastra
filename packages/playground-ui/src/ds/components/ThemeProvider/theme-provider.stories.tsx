import type { Meta, StoryObj } from '@storybook/react-vite';

import { ThemeToggle } from '../ThemeToggle';
import { ThemeProvider, useTheme } from './theme-provider';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';

const meta: Meta<typeof ThemeProvider> = {
  title: 'Providers/ThemeProvider',
  component: ThemeProvider,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ThemeProvider>;

const Inspector = () => {
  const { theme, resolvedTheme, systemTheme } = useTheme();
  return (
    <div className={`${raisedSurfaceStyle} text-foreground text-body grid gap-3 rounded-lg p-4`}>
      <div className="grid grid-cols-[120px_1fr] gap-2">
        <span className="text-muted-foreground">theme</span>
        <span className="font-mono">{theme}</span>
        <span className="text-muted-foreground">resolvedTheme</span>
        <span className="font-mono">{resolvedTheme}</span>
        <span className="text-muted-foreground">systemTheme</span>
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
