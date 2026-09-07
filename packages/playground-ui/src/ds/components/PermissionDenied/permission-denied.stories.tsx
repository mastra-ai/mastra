import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { Button } from '../Button';
import { PermissionDenied } from './PermissionDenied';

const meta: Meta<typeof PermissionDenied> = {
  title: 'Feedback/PermissionDenied',
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
