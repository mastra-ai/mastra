import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { ActivityBelt, ActivityWick } from './activity';
import type { ActivityStatus } from './activity';
import { Button } from '@/ds/components/Button';

const meta = {
  title: 'Feedback/Activity',
  component: ActivityWick,
  args: { status: 'working' },
  argTypes: { status: { control: 'select', options: ['initializing', 'working', 'ready'] } },
} satisfies Meta<typeof ActivityWick>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Wick: Story = {
  render: args => (
    <div className="bg-surface2 relative w-64 rounded-xl border border-transparent p-6">
      <ActivityWick {...args} />
      <span className="text-ui-sm text-foreground">Session activity</span>
    </div>
  ),
};

export const Belts: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-2">
      <div className="bg-surface2 text-ui-sm text-foreground relative rounded-lg py-3 pl-6">
        <ActivityBelt status="initializing" label="Preparing workspace" />
        Preparing workspace
      </div>
      <div className="bg-surface2 text-ui-sm text-foreground relative rounded-lg py-3 pl-6">
        <ActivityBelt status="working" label="Processing request" />
        Processing request
      </div>
      <div className="bg-surface2 text-ui-sm text-foreground relative rounded-lg py-3 pl-6">
        <ActivityBelt status="ready" label="Waiting for approval" />
        Waiting for approval
      </div>
    </div>
  ),
};

export const StateTransitions: Story = {
  render: () => {
    const [status, setStatus] = useState<ActivityStatus>('initializing');
    return (
      <div className="flex flex-col items-start gap-4">
        <div className="bg-surface2 relative w-64 rounded-xl border border-transparent p-6">
          <ActivityWick status={status} />
          <span className="text-ui-sm text-foreground">Session activity</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setStatus('initializing')}>Initialize</Button>
          <Button onClick={() => setStatus('working')}>Work</Button>
          <Button onClick={() => setStatus('ready')}>Wait for input</Button>
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status', { name: 'Initializing' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Work' }));
    await expect(canvas.getByRole('status', { name: 'Working' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Wait for input' }));
    await expect(canvas.getByRole('status', { name: 'Waiting on you' })).toBeVisible();
  },
};
