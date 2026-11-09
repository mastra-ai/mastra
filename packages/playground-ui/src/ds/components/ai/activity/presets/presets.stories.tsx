import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { NotificationActivity } from './notification-activity';
import { SignalActivity } from './signal-activity';
import { PullRequestIcon } from '@/ds/components/PullRequestIcon';

const snapshot = 'Board: work\nStage: building\nRevision: 4\nAwaiting review on the composer changes before landing.';

const meta = {
  title: 'AI/Activity/Presets',
  component: SignalActivity,
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
          'Presets over `ActivityItem` for events that are not tool calls. SignalActivity and NotificationActivity choose the icon, the label wording and the body renderer for one kind of event. A row only offers a disclosure when its body says more than the line already shows — a message that fits stays a single line and wraps instead of clipping. Width and vertical rhythm belong to the caller.',
      },
    },
  },
} satisfies Meta<typeof SignalActivity>;

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
        <NotificationActivity
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
          'Every event row, in the order a run produces them: signals report on the run, then notifications arrive. Factory and Studio render the same rows.',
      },
    },
  },
  render: () => (
    <div className="flex flex-col gap-1">
      <SignalActivity kind="state" label="factory-phase" mode="snapshot" message={snapshot} />
      <SignalActivity kind="reactive" label="work-item-feed" message="Damien: Keep the attachment previews." />
      <SignalActivity
        kind="reminder"
        label="System reminder"
        detail="/repo/packages/core/AGENTS.md"
        message="Keep changes scoped to the requested package."
      />
      <NotificationActivity
        state="merged"
        label="github"
        message="The composer changes were merged."
        icon={<PullRequestIcon status="merged" size={13} aria-hidden />}
        link={{ href: 'https://github.com/mastra-ai/mastra/pull/24263', label: 'Open on GitHub' }}
      />
      <NotificationActivity
        label="github / issue-opened"
        message="Opening a workflow shows a blank page."
        priority="high"
        status="delivered"
        pending="3"
      />
      <SignalActivity kind="state" label="factory-phase" mode="delta" message="Stage: building → review" />
    </div>
  ),
};

const deploymentMessage = 'The production deployment failed. Please check the logs.';
const buildFailureMessage = `Build failed:\n  packages/core: type error\n  Logs: https://example.com/${'a'.repeat(180)}`;

export const NarrowNotifications: Story = {
  render: () => (
    <div className="flex w-80 max-w-full flex-col gap-3">
      <NotificationActivity
        label="github / issue-opened"
        message="Opening a workflow shows a blank page."
        priority="high"
        status="delivered"
        pending="3"
      />
      <NotificationActivity
        label="Deployment"
        message={deploymentMessage}
        link={{ href: 'https://github.com/mastra-ai/mastra', label: 'Open on GitHub' }}
      />
      <NotificationActivity label="Build" message={buildFailureMessage} defaultOpen />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const notification = canvas.getByRole('group', { name: 'Notification: github / issue-opened' });
    const message = within(notification).getByText('Opening a workflow shows a blank page.');
    await expect(message.getBoundingClientRect().width).toBeGreaterThan(100);
    await expect(notification.scrollWidth).toBeLessThanOrEqual(notification.clientWidth);

    const deployment = within(canvas.getByRole('group', { name: 'Notification: Deployment' }));
    await userEvent.click(deployment.getByRole('button'));
    await expect(deployment.getByText(deploymentMessage, { selector: 'p' })).toBeVisible();

    const build = within(canvas.getByRole('group', { name: 'Notification: Build' }));
    const buildMessage = build.getByText(/Build failed:/, { selector: 'p' });
    await expect(getComputedStyle(buildMessage).whiteSpace).toBe('pre-wrap');
    await expect(buildMessage.scrollWidth).toBeLessThanOrEqual(buildMessage.clientWidth);
  },
};
