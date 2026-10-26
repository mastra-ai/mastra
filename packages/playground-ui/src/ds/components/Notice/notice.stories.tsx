import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowRightIcon, CopyIcon, RefreshCwIcon, TrophyIcon } from 'lucide-react';
import { useState } from 'react';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { Button } from '../Button/Button';
import { CodeBlock } from '../CodeBlock/code-block';
import { TooltipProvider } from '../Tooltip/tooltip';
import { Txt } from '../Txt/Txt';
import { Notice } from './Notice';

const previewClassName = 'mx-auto w-full max-w-200 rounded-lg bg-background p-6';

const meta: Meta<typeof Notice> = {
  title: 'Elements/Notice',
  component: Notice,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['warning', 'destructive', 'success', 'info', 'note'],
    },
  },
  decorators: [
    Story => (
      <TooltipProvider>
        <div className={previewClassName}>
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Notice>;

export const Warning: Story = {
  render: () => (
    <Notice
      variant="warning"
      title="Viewing previous version"
      action={
        <Notice.Button>
          Return to latest <ArrowRightIcon />
        </Notice.Button>
      }
    >
      <Notice.Message>Viewing version from Feb 12, 2026 at 7:38 AM</Notice.Message>
    </Notice>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Notice
      variant="destructive"
      title="Failed to load"
      action={
        <Notice.Button>
          Retry <RefreshCwIcon />
        </Notice.Button>
      }
    >
      <Notice.Message>Failed to load dataset. Please try again.</Notice.Message>
    </Notice>
  ),
};

export const Success: Story = {
  render: () => (
    <Notice
      variant="success"
      title="Tip"
      action={
        <Notice.Button>
          View items <ArrowRightIcon />
        </Notice.Button>
      }
    >
      <Notice.Message>Dataset successfully imported. 24 items added.</Notice.Message>
    </Notice>
  ),
};

export const Info: Story = {
  render: () => (
    <Notice
      variant="info"
      title="Read-only dataset"
      action={
        <Notice.Button>
          Clone dataset <CopyIcon />
        </Notice.Button>
      }
    >
      <Notice.Message>This dataset is read-only. Clone it to make changes.</Notice.Message>
    </Notice>
  ),
};

export const Note: Story = {
  render: () => (
    <Notice variant="note" title="Note">
      <Notice.Message>This is a note admonition with neutral styling.</Notice.Message>
    </Notice>
  ),
};

export const TitleOnly: Story = {
  render: () => <Notice variant="warning" title="Action required" />,
};

export const MessageOnly: Story = {
  render: () => <Notice variant="info">No eligible scorers have been defined to run.</Notice>,
};

export const MessageOnlyWithAction: Story = {
  render: () => (
    <Notice
      variant="destructive"
      action={
        <Notice.Button>
          Retry <RefreshCwIcon />
        </Notice.Button>
      }
    >
      Failed to load scorers.
    </Notice>
  ),
};

export const MessageOnlyWithActionLong: Story = {
  render: () => (
    <Notice
      variant="destructive"
      action={
        <Notice.Button>
          Retry <RefreshCwIcon />
        </Notice.Button>
      }
    >
      Failed to load scorers from the remote registry. The request timed out after 30 seconds. Check your network
      connection and confirm the registry endpoint is reachable, then retry to continue.
    </Notice>
  ),
};

const gitRemoteFailure =
  "Failed to set git remote: error: could not lock config file .git/config: File exists fatal: could not set 'remote.origin.url' to 'https://x-access-token:ghs_EXAMPLEtokenaGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9eyJhdWQiOiJhdXRobiIsImRpZ2VzdCI6IlF2QzJWbmNsIjNkbFZtbFBNUXJleDhxdnl2d1RMZ0Z2N2FQbXVlTnJ1TGVn@github.com/mastra-ai/mastra.git'";

export const MessageWithUnbreakableToken: Story = {
  render: () => (
    <Notice
      variant="destructive"
      title="We couldn't prepare the workspace"
      action={
        <Notice.Button>
          Retry <RefreshCwIcon />
        </Notice.Button>
      }
    >
      <CodeBlock code={gitRemoteFailure} />
    </Notice>
  ),
};

export const TitledWithUnbreakableToken: Story = {
  render: () => (
    <Notice variant="destructive" title="Workspace unavailable">
      <Notice.Message>We couldn't prepare the workspace.</Notice.Message>
      <CodeBlock code={gitRemoteFailure} />
    </Notice>
  ),
};

export const CustomIcon: Story = {
  render: () => (
    <Notice variant="success" title="Achievement unlocked" icon={<TrophyIcon />}>
      <Notice.Message>You've completed all onboarding steps.</Notice.Message>
    </Notice>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Notice
        variant="success"
        title="Tip"
        action={
          <Notice.Button>
            View items <ArrowRightIcon />
          </Notice.Button>
        }
      >
        <Notice.Message>Dataset successfully imported. 24 items added.</Notice.Message>
      </Notice>
      <Notice variant="info" title="Info">
        <Notice.Message>This dataset is read-only. Clone it to make changes.</Notice.Message>
      </Notice>
      <Notice
        variant="warning"
        title="Caution"
        action={
          <Notice.Button>
            Return to latest <ArrowRightIcon />
          </Notice.Button>
        }
      >
        <Notice.Message>Viewing version from Feb 12, 2026 at 7:38 AM</Notice.Message>
      </Notice>
      <Notice
        variant="destructive"
        title="Danger"
        action={
          <Notice.Button>
            Retry <RefreshCwIcon />
          </Notice.Button>
        }
      >
        <Notice.Message>Failed to load dataset. Please try again.</Notice.Message>
      </Notice>
      <Notice variant="note" title="Note">
        <Notice.Message>This is a note admonition with neutral styling.</Notice.Message>
      </Notice>
    </div>
  ),
};

export const Narrow: Story = {
  render: () => (
    <div className="flex w-91 max-w-full flex-col gap-3">
      <Notice
        variant="warning"
        title="Viewing previous version"
        action={
          <Notice.Button>
            Return to latest <ArrowRightIcon />
          </Notice.Button>
        }
      >
        <Notice.Message>Viewing version from Feb 12, 2026 at 7:38 AM</Notice.Message>
      </Notice>
      <Notice
        variant="destructive"
        action={
          <Notice.Button>
            Retry <RefreshCwIcon />
          </Notice.Button>
        }
      >
        Couldn't load scorers from the remote registry. The request timed out after 30 seconds. Check your network
        connection and confirm the registry endpoint is reachable, then retry.
      </Notice>
      <Notice variant="info">No deploys yet. Deploy to production to create your first deploy.</Notice>
      <Notice
        variant="success"
        title="Tip"
        action={
          <Notice.Button>
            View items <ArrowRightIcon />
          </Notice.Button>
        }
      >
        <Notice.Message>Dataset imported. 24 items added.</Notice.Message>
      </Notice>
    </div>
  ),
};

function QuietNoticeExamples() {
  const [lastAction, setLastAction] = useState('No actions yet');
  const [dismissed, setDismissed] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section className="flex min-w-0 flex-col gap-3" aria-label="Actions on the right">
        <Txt as="h2" variant="column" tone="muted">
          Actions on the right
        </Txt>
        <Notice
          variant="info"
          title="No deploys yet"
          actionPlacement="end"
          action={
            <Button type="button" onClick={() => setLastAction('View setup')}>
              View setup
            </Button>
          }
        >
          <Notice.Message>Push to a linked branch to create your first deploy.</Notice.Message>
        </Notice>
        <Notice
          variant="success"
          title="Dataset imported"
          actionPlacement="end"
          action={
            <Button type="button" onClick={() => setLastAction('View items')}>
              View items
            </Button>
          }
        >
          <Notice.Message>24 items added to your dataset.</Notice.Message>
        </Notice>
        <Notice
          variant="warning"
          title="Viewing previous version"
          actionPlacement="end"
          action={
            <Button type="button" onClick={() => setLastAction('Return to latest')}>
              Return to latest
            </Button>
          }
        >
          <Notice.Message>Return to the latest version to make changes.</Notice.Message>
        </Notice>
        <Notice
          variant="destructive"
          title="Couldn’t load scorers"
          actionPlacement="end"
          action={
            <Button type="button" onClick={() => setLastAction('Retry')}>
              Retry
            </Button>
          }
        >
          <Notice.Message>The registry request timed out. Check your connection and retry.</Notice.Message>
        </Notice>
      </section>
      <section className="flex min-w-0 flex-col gap-3" aria-label="Actions below the message">
        <Txt as="h2" variant="column" tone="muted">
          Actions below the message
        </Txt>
        <Notice
          variant="warning"
          title="API key expires soon"
          action={<Notice.Button onClick={() => setLastAction('Rotate now')}>Rotate now</Notice.Button>}
        >
          Rotate your key before it expires to keep requests working.
        </Notice>
        <Notice
          variant="destructive"
          title="Couldn’t load scorers"
          action={
            <>
              <Notice.Button onClick={() => setLastAction('Retry')}>Retry</Notice.Button>
              <Notice.Button render={<a href="#troubleshoot" />} onClick={() => setLastAction('Troubleshoot')}>
                Troubleshoot
              </Notice.Button>
            </>
          }
        >
          The registry request timed out. Check your connection and retry.
        </Notice>
      </section>
      <Notice variant="info">No eligible scorers have been defined to run.</Notice>
      <Notice variant="destructive">
        Couldn’t load scorers from the remote registry. The request timed out after 30 seconds. Check your connection
        and confirm the registry endpoint is reachable, then retry.
      </Notice>
      <Notice variant="note" title="Note">
        This dataset is read-only.
      </Notice>
      <section className="flex min-w-0 flex-col gap-3" aria-label="Dismissible notices">
        <Txt as="h2" variant="column" tone="muted">
          Dismissible
        </Txt>
        {!dismissed ? (
          <Notice variant="info" title="Connection restored" onDismiss={() => setDismissed(true)}>
            You can continue working in this workspace.
          </Notice>
        ) : (
          <Notice.Button onClick={() => setDismissed(false)}>Show notice again</Notice.Button>
        )}
      </section>
      <Txt as="p" variant="caption" role="status" aria-live="polite">
        {lastAction}
      </Txt>
    </div>
  );
}

export const QuietTints: Story = {
  render: () => <QuietNoticeExamples />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const context = canvasElement.ownerDocument.createElement('canvas').getContext('2d');
    if (!context) throw new Error('Canvas color conversion unavailable');
    const light = canvasElement.ownerDocument.documentElement.classList.contains('light');
    const expectedFills = light
      ? [
          [244, 248, 255],
          [243, 251, 244],
          [255, 249, 232],
          [255, 246, 245],
        ]
      : [
          [19, 23, 30],
          [20, 24, 21],
          [27, 22, 20],
          [34, 19, 18],
        ];
    const notices = canvasElement.querySelectorAll('[aria-label="Actions on the right"] [data-slot="notice"]');
    for (const [index, notice] of Array.from(notices).entries()) {
      const style = getComputedStyle(notice);
      context.fillStyle = style.backgroundColor;
      context.fillRect(0, 0, 1, 1);
      await expect(Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3)).toEqual(expectedFills[index]);
      await expect(style.backgroundImage).toBe('none');
      await expect(style.borderTopWidth).toBe('0px');
      const action = notice.querySelector('button');
      if (!action) throw new Error('Missing notice action');
      await expect(getComputedStyle(action).height).toBe('30px');
      await expect(getComputedStyle(action).fontSize).toBe('13px');
      await expect(getComputedStyle(action).fontWeight).toBe('500');
      const content = notice.querySelector('[data-slot="notice-content"]');
      if (!content) throw new Error('Missing notice message');
      const contentBounds = content.getBoundingClientRect();
      const actionBounds = action.getBoundingClientRect();
      if (canvasElement.ownerDocument.defaultView?.matchMedia('(min-width: 640px)').matches) {
        await expect(actionBounds.left).toBeGreaterThanOrEqual(contentBounds.right + 11);
      } else {
        await expect(actionBounds.top).toBeGreaterThanOrEqual(contentBounds.bottom + 7);
      }
      if (!light) await expect(style.boxShadow).not.toContain('color(srgb');
    }
    const footer = canvas.getByRole('region', { name: 'Actions below the message' });
    for (const action of footer.querySelectorAll('button, a')) {
      const style = getComputedStyle(action);
      await expect(style.fontSize).toBe('13px');
      await expect(style.fontWeight).toBe('500');
      await expect(style.textDecorationLine).toBe('none');
      const label = action.querySelector('[data-slot=button-label]');
      if (!label) throw new Error('Missing shared link label');
      await expect(getComputedStyle(label, '::after').scale).toBe('0 1');
    }
    const rightActions = within(canvas.getByRole('region', { name: 'Actions on the right' }));
    for (const action of ['View setup', 'View items', 'Return to latest', 'Retry']) {
      await userEvent.click(rightActions.getByRole('button', { name: action }));
      await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent(action));
    }
    const rotate = canvas.getByRole('button', { name: 'Rotate now' });
    rotate.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Rotate now'));
    await userEvent.tab();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Retry'));
    await userEvent.tab();
    await expect(canvas.getByRole('link', { name: 'Troubleshoot' })).toHaveFocus();
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss notice' }));
    await waitFor(() => expect(canvas.queryByText('Connection restored')).toBeNull());
    await userEvent.click(canvas.getByRole('button', { name: 'Show notice again' }));
    await waitFor(() => expect(canvas.getByText('Connection restored')).toBeVisible());
    canvas.getByRole('link', { name: 'Troubleshoot' }).focus();
  },
};
