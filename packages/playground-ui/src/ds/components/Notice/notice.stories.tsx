import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowRightIcon, CopyIcon, RefreshCwIcon, TrophyIcon } from 'lucide-react';
import { CodeBlock } from '../CodeBlock';
import { TooltipProvider } from '../Tooltip';
import { Notice } from './Notice';

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
        <div className="mx-auto w-full max-w-200 rounded-lg bg-background p-6">
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
    <div className="flex w-91 flex-col gap-3">
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
