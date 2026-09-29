import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ChatNotification } from '../chat-notification';
import { PullRequestIcon } from '@/ds/components/PullRequestIcon';

const meta = {
  title: 'AI/Chat events/Notification',
  component: ChatNotification,
  args: {
    label: 'factory',
    message: 'This work was moved from the planning stage to the building stage.',
    variant: 'row',
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['row', 'notice'] },
    priority: { control: 'select', options: ['low', 'medium', 'high', 'urgent'] },
    icon: { control: false },
  },
  decorators: [
    Story => (
      <div className="mx-auto w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Shared notification presentation. Factory maps incoming events to compact rows and supplies event icons and links. Studio maps notification signals to notices with priority, status and pending counts. Event delivery and metadata parsing stay in application adapters. These are chat messages, not transient toasts or tool executions.',
      },
    },
  },
} satisfies Meta<typeof ChatNotification>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LaneChange: Story = {};
export const Expanded: Story = { args: { defaultOpen: true } };
export const Summary: Story = {
  args: { state: 'summary', label: 'Notification summary', message: '3 updates: 2 pull requests and 1 issue.' },
};
export const PullRequestMerged: Story = {
  args: {
    state: 'merged',
    label: 'github',
    message: 'The composer changes were merged.',
    icon: <PullRequestIcon status="merged" size={13} aria-hidden />,
    link: { href: 'https://github.com/mastra-ai/mastra/pull/24263', label: 'Open on GitHub' },
    defaultOpen: true,
  },
};
export const PullRequestClosed: Story = {
  args: {
    state: 'closed',
    label: 'github',
    message: 'The pull request was closed.',
    icon: <PullRequestIcon status="closed" size={13} aria-hidden />,
  },
};
export const Notice: Story = {
  args: {
    variant: 'notice',
    label: 'github / issue-opened',
    message: 'Opening a workflow shows a blank page.',
    priority: 'high',
    status: 'delivered',
    pending: '0',
  },
};
export const Priorities: Story = {
  render: args => (
    <div className="flex flex-col gap-3">
      {['low', 'medium', 'high', 'urgent'].map(priority => (
        <ChatNotification
          key={priority}
          {...args}
          variant="notice"
          priority={priority}
          label={`Notification · ${priority}`}
        />
      ))}
    </div>
  ),
};
export const NoticeSummary: Story = {
  args: {
    variant: 'notice',
    label: 'Notification summary',
    message: 'github: 2, slack: 1',
    priority: 'medium',
    pending: '3',
  },
};
export const TitleOnly: Story = { args: { variant: 'notice', label: 'Notification', message: '' } };
export const LongContent: Story = {
  args: {
    message:
      'The work item has moved to review. Check the keyboard interaction, attachment previews and the narrow layout before approving.\n\nThe previous response remains available in the thread.',
    defaultOpen: true,
  },
};
export const KeyboardDisclosure: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard(' ');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveFocus();
  },
};
