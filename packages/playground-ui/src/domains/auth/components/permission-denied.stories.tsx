import type { Meta, StoryObj } from '@storybook/react-vite';

import { PermissionDenied } from './permission-denied';

const meta: Meta<typeof PermissionDenied> = {
  title: 'Domains/Auth/PermissionDenied',
  component: PermissionDenied,
  parameters: { layout: 'fullscreen' },
  args: { resource: 'workflows' },
};

export default meta;
type Story = StoryObj<typeof PermissionDenied>;

export const Default: Story = {};

export const Fill: Story = {
  args: { variant: 'fill' },
  render: args => (
    <div className="h-120 border border-dashed border-border">
      <PermissionDenied {...args} />
    </div>
  ),
};
