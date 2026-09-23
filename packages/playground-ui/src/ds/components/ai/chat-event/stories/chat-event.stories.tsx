import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { ChatNotification } from '../chat-notification';
import { ChatSignal } from '../chat-signal';
import { ChatSkill } from '../chat-skill';
import { TranscriptDivider } from '@/ds/components/ai/transcript-divider';
import { PullRequestIcon } from '@/ds/components/PullRequestIcon';

const snapshot = 'Board: work\nStage: building\nRevision: 4\nAwaiting review on the composer changes before landing.';

const meta = {
  title: 'AI/Chat event',
  component: ChatSignal,
  args: { kind: 'state', label: 'factory-phase', mode: 'snapshot', message: snapshot },
  argTypes: {
    kind: { control: 'inline-radio', options: ['state', 'reactive', 'reminder'] },
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
          'Presets over `ActivityItem` for events that are not tool calls. ChatSignal, ChatNotification and ChatSkill choose the icon, the label wording and the body renderer for one kind of event. A row only offers a disclosure when its body says more than the line already shows — a message that fits stays a single line and wraps instead of clipping. Width and vertical rhythm belong to the caller.',
      },
    },
  },
} satisfies Meta<typeof ChatSignal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Signal: Story = {};

export const SignalThatFitsItsLine: Story = {
  args: { kind: 'reactive', label: 'files-changed', mode: undefined, message: 'src/chat/composer.tsx was updated.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument();
  },
};

export const NotificationPriorities: Story = {
  parameters: {
    docs: { description: { story: 'Priority is a badge on the line, not a different presentation.' } },
  },
  render: () => (
    <div className="flex flex-col gap-1">
      {(['low', 'medium', 'high', 'urgent'] as const).map(priority => (
        <ChatNotification
          key={priority}
          label="github / issue-opened"
          message="Opening a workflow shows a blank page."
          priority={priority}
        />
      ))}
    </div>
  ),
};

export const Transcript: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Every event row, in the order a run produces them: a skill activation opens the run, signals report on it, notifications arrive, and a divider marks the silence before the next turn. Factory and Studio render the same rows.',
      },
    },
  },
  render: () => (
    <div className="flex flex-col gap-1">
      <ChatSkill name="factory-build" instructions="Implement the approved plan." />
      <ChatSignal kind="state" label="factory-phase" mode="snapshot" message={snapshot} />
      <ChatSignal kind="reactive" label="work-item-feed" message="Damien: Keep the attachment previews." />
      <ChatSignal
        kind="reminder"
        label="System reminder"
        detail="/repo/packages/core/AGENTS.md"
        message="Keep changes scoped to the requested package."
      />
      <ChatNotification
        state="merged"
        label="github"
        message="The composer changes were merged."
        icon={<PullRequestIcon status="merged" size={13} aria-hidden />}
        link={{ href: 'https://github.com/mastra-ai/mastra/pull/24263', label: 'Open on GitHub' }}
      />
      <ChatNotification
        label="github / issue-opened"
        message="Opening a workflow shows a blank page."
        priority="high"
        status="delivered"
        pending="3"
      />
      <TranscriptDivider label="24 minutes later" title="Sep 17, 2026, 2:24 PM" />
      <ChatSignal kind="state" label="factory-phase" mode="delta" message="Stage: building → review" />
    </div>
  ),
};
