import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ConnectionRequestCard } from './connection-request-card';

const meta = {
  title: 'AI/Connection Request',
  component: ConnectionRequestCard,
  args: {
    displayName: 'Linear',
    logoUrl: 'https://cdn.simpleicons.org/linear',
    status: 'request',
    children: 'I need access to Linear to file the bug you described.',
    onConnect: fn(),
    onDecline: fn(),
    onRetry: fn(),
  },
  argTypes: {
    status: {
      control: 'select',
      options: ['request', 'waiting', 'connected', 'failed', 'declined', 'expired'],
    },
  },
  decorators: [
    Story => (
      <div className="mx-auto w-full max-w-xl p-4">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ConnectionRequestCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Request: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Connect' }));
    await expect(args.onConnect).toHaveBeenCalledOnce();
    await userEvent.click(canvas.getByRole('button', { name: 'Not now' }));
    await expect(args.onDecline).toHaveBeenCalledOnce();
  },
};

export const WithoutActions: Story = {
  args: { onConnect: undefined, onDecline: undefined, onRetry: undefined },
};

export const Waiting: Story = { args: { status: 'waiting' } };

export const Connected: Story = { args: { status: 'connected', accountLabel: 'acme' } };

export const Failed: Story = { args: { status: 'failed' } };

export const Declined: Story = { args: { status: 'declined' } };

export const Expired: Story = {
  args: { status: 'expired' },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Try again' }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};

export const WithoutLogo: Story = { args: { logoUrl: undefined } };

export const LongReason: Story = {
  args: {
    displayName: 'Google Workspace',
    logoUrl: undefined,
    children:
      'I need access to Google Workspace to read the shared planning doc, check the calendar for the review meeting, and draft the follow-up email to everyone who attended.',
  },
};
