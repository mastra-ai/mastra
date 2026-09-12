import type { Meta, StoryObj } from '@storybook/react-vite';
import { SignalBadge } from '../messages/signal-badge';
import type { SignalData } from '../messages/signal-data';

const meta = {
  title: 'AI/Signals',
  component: SignalBadge,
  parameters: {
    docs: {
      description: {
        component: 'Studio signal presentation. Factory owns separate signal rows and notification cards.',
      },
    },
  },
} satisfies Meta<typeof SignalBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const State: Story = {
  args: {
    signal: {
      type: 'state',
      attributes: { id: 'workspace', mode: 'updated' },
      contents: 'The workspace is ready for the next step.',
    } satisfies SignalData,
  },
};

export const Reactive: Story = {
  args: {
    signal: {
      type: 'reactive',
      tagName: 'review-completed',
      contents: 'The review finished while the response was streaming.',
    } satisfies SignalData,
  },
};

export const Notification: Story = {
  args: {
    signal: {
      type: 'notification',
      attributes: { source: 'review', kind: 'completed', priority: 'high', status: 'pending' },
      contents: 'Two files need attention before this change can be merged.',
    } satisfies SignalData,
  },
};
