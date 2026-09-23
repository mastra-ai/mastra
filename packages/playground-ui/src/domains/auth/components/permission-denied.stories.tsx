import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { PermissionDenied } from './permission-denied';
import { Button } from '@/ds/components/Button';

const meta: Meta<typeof PermissionDenied> = {
  title: 'Domains/Auth/PermissionDenied',
  component: PermissionDenied,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof PermissionDenied>;

export const Default: Story = {};

export const ResourceSpecific: Story = {
  args: {
    resource: 'production workflows',
  },
};

export const CustomRecovery: Story = {
  args: {
    title: 'Workspace access required',
    description: 'Ask a workspace administrator to add you before opening these agents.',
    actionSlot: <Button onClick={fn()}>Request access</Button>,
  },
};

export const Fill: Story = {
  args: { variant: 'fill' },
  render: args => (
    <div className="h-120 border border-dashed border-border">
      <PermissionDenied {...args} />
    </div>
  ),
};
