import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowRightIcon, CopyIcon, RefreshCwIcon, TrophyIcon } from 'lucide-react';
import { useState } from 'react';
import { expect } from 'storybook/test';
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
          action={<Button type="button">View setup</Button>}
        >
          <Notice.Message>Push to a linked branch to create your first deploy.</Notice.Message>
        </Notice>
        <Notice
          variant="success"
          title="Dataset imported"
          actionPlacement="end"
          action={<Button type="button">View items</Button>}
        >
          <Notice.Message>24 items added to your dataset.</Notice.Message>
        </Notice>
        <Notice
          variant="warning"
          title="Viewing previous version"
          actionPlacement="end"
          action={<Button type="button">Return to latest</Button>}
        >
          <Notice.Message>Return to the latest version to make changes.</Notice.Message>
        </Notice>
        <Notice
          variant="destructive"
          title="Couldn’t load scorers"
          actionPlacement="end"
          action={<Button type="button">Retry</Button>}
        >
          <Notice.Message>The registry request timed out. Check your connection and retry.</Notice.Message>
        </Notice>
      </section>
      <section className="flex min-w-0 flex-col gap-3" aria-label="Actions below the message">
        <Txt as="h2" variant="column" tone="muted">
          Actions below the message
        </Txt>
        <Notice variant="warning" title="API key expires soon" action={<Notice.Button>Rotate now</Notice.Button>}>
          Rotate your key before it expires to keep requests working.
        </Notice>
        <Notice
          variant="destructive"
          title="Couldn’t load scorers"
          action={
            <>
              <Notice.Button>Retry</Notice.Button>
              <Notice.Button render={<a href="#troubleshoot" />}>Troubleshoot</Notice.Button>
            </>
          }
        >
          The registry request timed out. Check your connection and retry.
        </Notice>
      </section>
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
    </div>
  );
}

export const QuietTints: Story = {
  render: () => <QuietNoticeExamples />,
  play: async ({ canvasElement }) => {
    const wide = canvasElement.ownerDocument.defaultView?.matchMedia('(min-width: 640px)').matches;
    const notices = canvasElement.querySelectorAll('[aria-label="Actions on the right"] [data-slot="notice"]');
    for (const notice of notices) {
      const action = notice.querySelector('button');
      const content = notice.querySelector('[data-slot="notice-content"]');
      if (!action || !content) throw new Error('Missing notice action or content');
      const contentBounds = content.getBoundingClientRect();
      const actionBounds = action.getBoundingClientRect();
      if (wide) {
        await expect(actionBounds.left).toBeGreaterThanOrEqual(contentBounds.right);
      } else {
        await expect(actionBounds.top).toBeGreaterThanOrEqual(contentBounds.bottom);
      }
    }
  },
};
