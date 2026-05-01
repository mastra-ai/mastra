import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowRightIcon, CopyIcon, RefreshCwIcon, TrophyIcon } from 'lucide-react';
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
      <div className="mx-auto w-full max-w-[800px] rounded-lg bg-surface2 p-6">
        <Story />
      </div>
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
