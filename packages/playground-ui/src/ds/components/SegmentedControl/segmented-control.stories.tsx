import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bell, BellOff, Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';

import { SegmentedControl } from './segmented-control';
import type { SegmentedControlOption } from './segmented-control';

const meta: Meta<typeof SegmentedControl> = {
  title: 'Elements/SegmentedControl',
  component: SegmentedControl,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof SegmentedControl>;

const PERMISSIONS: SegmentedControlOption[] = [
  { value: 'allow', label: 'Allow' },
  { value: 'ask', label: 'Ask' },
  { value: 'deny', label: 'Deny' },
];

const NOTIFICATIONS: SegmentedControlOption[] = [
  { value: 'off', label: 'Off' },
  { value: 'bell', label: 'Bell' },
  { value: 'system', label: 'System' },
  { value: 'both', label: 'Both' },
];

const THEMES: SegmentedControlOption[] = [
  { value: 'system', label: 'System', icon: <Monitor /> },
  { value: 'light', label: 'Light', icon: <Sun /> },
  { value: 'dark', label: 'Dark', icon: <Moon /> },
];

function Controlled({
  options,
  initial,
  ...props
}: { options: SegmentedControlOption[]; initial: string } & Partial<React.ComponentProps<typeof SegmentedControl>>) {
  const [value, setValue] = useState(initial);
  return <SegmentedControl aria-label="Example" {...props} options={options} value={value} onValueChange={setValue} />;
}

export const Default: Story = {
  render: () => <Controlled options={PERMISSIONS} initial="ask" aria-label="Permission" />,
};

export const Text: Story = {
  render: () => <Controlled options={NOTIFICATIONS} initial="both" aria-label="Notifications" />,
};

export const IconOnly: Story = {
  render: () => <Controlled options={THEMES} initial="system" aria-label="Theme" iconOnly />,
};

export const IconAndText: Story = {
  render: () => (
    <Controlled
      options={[
        { value: 'on', label: 'On', icon: <Bell /> },
        { value: 'off', label: 'Off', icon: <BellOff /> },
      ]}
      initial="on"
      aria-label="Alerts"
    />
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <Controlled options={PERMISSIONS} initial="ask" aria-label="Small" size="sm" />
      <Controlled options={PERMISSIONS} initial="ask" aria-label="Medium" size="md" />
      <Controlled options={PERMISSIONS} initial="ask" aria-label="Large" size="lg" />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <Controlled options={PERMISSIONS} initial="ask" aria-label="Disabled" disabled />
      <Controlled
        options={[...PERMISSIONS.slice(0, 2), { value: 'deny', label: 'Deny', disabled: true }]}
        initial="ask"
        aria-label="One option disabled"
      />
    </div>
  ),
};
