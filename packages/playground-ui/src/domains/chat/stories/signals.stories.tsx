import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { UserTextPartRenderer } from '../messages/renderers/user-text-part-renderer';
import { SignalBadge } from '../messages/signal-badge';
import type { SignalData } from '../messages/signal-data';

const meta = {
  title: 'AI/Signals',
  component: SignalBadge,
  parameters: {
    docs: {
      description: {
        component:
          'Studio adapters over the shared SignalActivity and NotificationActivity components. `SignalBadge` maps a signal part to a card; `UserTextPartRenderer` parses `<system-reminder>` user text into the same card, folded. AI/Activity/Presets documents the row and card presentations; AI/Chat assembles the full Studio and Factory conversations.',
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

const reminderText =
  '<system-reminder path="/repo/AGENTS.md">Keep changes scoped to the requested package.</system-reminder>';

export const SystemReminder: Story = {
  args: { signal: undefined },
  render: () => <UserTextPartRenderer part={{ type: 'text', text: reminderText }} />,
};

export const SystemReminderExpanded: Story = {
  ...SystemReminder,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /System reminder/ }));
    await expect(canvas.getByText('Keep changes scoped to the requested package.')).toBeVisible();
  },
};
