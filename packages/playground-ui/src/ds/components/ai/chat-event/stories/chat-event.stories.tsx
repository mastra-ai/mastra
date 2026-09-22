import type { Meta, StoryObj } from '@storybook/react-vite';
import { Database, Info } from 'lucide-react';
import { expect, userEvent, within } from 'storybook/test';
import { ChatEvent } from '../chat-event';
import { ChatNotification } from '../chat-notification';
import { ChatSignal } from '../chat-signal';
import { ChatSkill } from '../chat-skill';
import { TranscriptDivider } from '@/ds/components/ai/transcript-divider';
import { Badge } from '@/ds/components/Badge';
import { PullRequestIcon } from '@/ds/components/PullRequestIcon';
import { Txt } from '@/ds/components/Txt';

const snapshot = 'Board: work\nStage: building\nRevision: 4\nAwaiting review on the composer changes before landing.';

const body = (
  <Txt variant="caption" className="break-words whitespace-pre-wrap">
    {snapshot}
  </Txt>
);

const meta = {
  title: 'AI/Chat event',
  component: ChatEvent,
  args: {
    icon: <Info size={13} className="text-muted-foreground" aria-hidden />,
    label: 'State snapshot: factory-phase',
    detail: 'Board: work · Stage: building',
    'aria-label': 'Signal: state snapshot',
    children: body,
  },
  argTypes: {
    density: { control: 'inline-radio', options: ['row', 'card'] },
    collapsible: { control: 'boolean' },
    icon: { control: false },
    children: { control: false },
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
          'One component behind every chat event. `density` picks the presentation — `row` for a dense transcript line, `card` for a block in a conversation — and everything else is configuration: `icon`, `label`, `detail`, `badges`, the body, and whether the body folds. Rows fold by default; cards show their body inline unless `collapsible` is set. Width and vertical rhythm belong to the caller.\n\nChatSignal, ChatNotification and ChatSkill are presets over it: they choose the icon, the label wording and the body renderer for one kind of event. A row preset only offers a disclosure when the body says more than the line already shows — a message that fits in the preview stays a single line. ChatNotification keeps a second `notice` presentation on Notice, because priority colouring is severity rather than structure.\n\nThe last two stories are the only two places these run: Factory renders rows in a dense transcript, Studio renders cards inside a conversation.',
      },
    },
  },
} satisfies Meta<typeof ChatEvent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Row: Story = {};

export const RowExpanded: Story = { args: { defaultOpen: true } };

export const RowWithoutBody: Story = {
  args: { children: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument();
  },
};

export const Card: Story = {
  args: {
    density: 'card',
    icon: <Database className="size-4" aria-hidden />,
    label: 'workspace',
    detail: undefined,
    badges: <Badge size="sm">snapshot</Badge>,
  },
};

export const CardCollapsible: Story = {
  args: { ...Card.args, collapsible: true, detail: '/repo/packages/core/AGENTS.md', label: 'System reminder' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /System reminder/ })).toBeVisible();
    await expect(canvas.queryByText(/Revision: 4/)).not.toBeInTheDocument();
  },
};

export const KeyboardDisclosure: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button');
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard(' ');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveFocus();
  },
};

export const FactoryTranscript: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Every row Factory puts in a transcript, in the order a run produces them. A skill activation opens the run, state and reactive signals report on it, a notification arrives from GitHub, and a divider marks the silence before the next turn. Only the rows whose body says more than their preview carry a disclosure.',
      },
    },
  },
  render: () => (
    <div className="flex flex-col gap-1">
      <ChatSkill name="factory-build" instructions="Implement the approved plan." />
      <ChatSignal kind="state" label="State snapshot: factory-phase" message={snapshot} />
      <ChatSignal kind="reactive" label="work-item-feed" message="Damien: Keep the attachment previews." />
      <ChatSignal kind="reminder" label="System reminder" message="Run the focused tests before submitting." />
      <ChatNotification
        state="merged"
        label="github"
        message="The composer changes were merged."
        icon={<PullRequestIcon status="merged" size={13} aria-hidden />}
        link={{ href: 'https://github.com/mastra-ai/mastra/pull/24263', label: 'Open on GitHub' }}
      />
      <ChatNotification
        state="summary"
        label="Notification summary"
        message="3 updates: 2 pull requests and 1 issue."
      />
      <TranscriptDivider label="24 minutes later" title="Sep 17, 2026, 2:24 PM" />
      <ChatSignal kind="state" label="State delta: factory-phase" message="Stage: building → review" />
    </div>
  ),
};

export const StudioConversation: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'What Studio shows between messages. State and reactive signals are cards, a system reminder is a card that stays folded until asked, and a notification is a Notice because its priority is a severity. Studio caps them at 80% of the thread width — the width is the page\u2019s, not the component\u2019s.',
      },
    },
  },
  render: () => (
    <div className="flex max-w-[80%] flex-col gap-3">
      <ChatSignal variant="card" kind="state" label="factory-phase" mode="snapshot" message={snapshot} />
      <ChatSignal variant="card" kind="reactive" label="files-changed" message="src/chat/composer.tsx was updated." />
      <ChatSignal
        variant="card"
        kind="reminder"
        collapsible
        label="System reminder"
        detail="/repo/packages/core/AGENTS.md"
        message="Keep changes scoped to the requested package."
      />
      <ChatNotification
        variant="notice"
        label="github / issue-opened"
        message="Opening a workflow shows a blank page."
        priority="high"
        status="delivered"
        pending="3"
      />
    </div>
  ),
};

export const NotificationPriorities: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The notice ladder Studio drives from a notification\u2019s priority. Colour is severity here, which is why this presentation stays on Notice instead of the card.',
      },
    },
  },
  render: () => (
    <div className="flex max-w-[80%] flex-col gap-3">
      {(['low', 'medium', 'high', 'urgent'] as const).map(priority => (
        <ChatNotification
          key={priority}
          variant="notice"
          label={`github / issue-opened · ${priority}`}
          message="Opening a workflow shows a blank page."
          priority={priority}
        />
      ))}
    </div>
  ),
};
