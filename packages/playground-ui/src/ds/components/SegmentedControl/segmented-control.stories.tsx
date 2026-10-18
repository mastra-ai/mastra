import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bell, BellOff, Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';

import { SegmentedControl, SegmentedControlItem } from './segmented-control';
import type { SegmentedControlProps } from './segmented-control';

const meta: Meta<typeof SegmentedControl> = {
  title: 'Elements/SegmentedControl',
  component: SegmentedControl,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof SegmentedControl>;

function Controlled({
  initial,
  ...props
}: { initial: string } & Omit<SegmentedControlProps, 'value' | 'onValueChange'>) {
  const [value, setValue] = useState(initial);
  return <SegmentedControl {...props} value={value} onValueChange={setValue} />;
}

const permissionItems = (
  <>
    <SegmentedControlItem value="allow">Allow</SegmentedControlItem>
    <SegmentedControlItem value="ask">Ask</SegmentedControlItem>
    <SegmentedControlItem value="deny">Deny</SegmentedControlItem>
  </>
);

export const Default: Story = {
  render: () => (
    <Controlled aria-label="Permission" initial="ask">
      {permissionItems}
    </Controlled>
  ),
};

export const Text: Story = {
  render: () => (
    <Controlled aria-label="Notifications" initial="both">
      <SegmentedControlItem value="off">Off</SegmentedControlItem>
      <SegmentedControlItem value="bell">Bell</SegmentedControlItem>
      <SegmentedControlItem value="system">System</SegmentedControlItem>
      <SegmentedControlItem value="both">Both</SegmentedControlItem>
    </Controlled>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <Controlled aria-label="Theme" initial="system" iconOnly>
      <SegmentedControlItem value="system" aria-label="System">
        <Monitor />
      </SegmentedControlItem>
      <SegmentedControlItem value="light" aria-label="Light">
        <Sun />
      </SegmentedControlItem>
      <SegmentedControlItem value="dark" aria-label="Dark">
        <Moon />
      </SegmentedControlItem>
    </Controlled>
  ),
};

export const IconAndText: Story = {
  render: () => (
    <Controlled aria-label="Alerts" initial="on">
      <SegmentedControlItem value="on">
        <Bell /> On
      </SegmentedControlItem>
      <SegmentedControlItem value="off">
        <BellOff /> Off
      </SegmentedControlItem>
    </Controlled>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <Controlled aria-label="Small" initial="ask" size="sm">
        {permissionItems}
      </Controlled>
      <Controlled aria-label="Medium" initial="ask" size="md">
        {permissionItems}
      </Controlled>
      <Controlled aria-label="Large" initial="ask" size="lg">
        {permissionItems}
      </Controlled>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <Controlled aria-label="Disabled" initial="ask" disabled>
        {permissionItems}
      </Controlled>
      <Controlled aria-label="One option disabled" initial="ask">
        <SegmentedControlItem value="allow">Allow</SegmentedControlItem>
        <SegmentedControlItem value="ask">Ask</SegmentedControlItem>
        <SegmentedControlItem value="deny" disabled title="Not available on this plan">
          Deny
        </SegmentedControlItem>
      </Controlled>
    </div>
  ),
};
