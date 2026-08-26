import type { Meta, StoryObj } from '@storybook/react-vite';

import { PendingIndicator } from './pending-indicator';

const meta: Meta<typeof PendingIndicator> = {
  title: 'Feedback/PendingIndicator',
  component: PendingIndicator,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof PendingIndicator>;

export const Default: Story = {};

export const InConversation: Story = {
  render: () => (
    <div className="border-border1 bg-surface2 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 rounded-xl border p-5">
      <p className="text-ui-sm text-neutral5">Find the latest failed workflow runs.</p>
      <PendingIndicator />
    </div>
  ),
};
