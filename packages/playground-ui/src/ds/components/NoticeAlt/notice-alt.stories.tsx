import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowRightIcon, CopyIcon, RefreshCwIcon, TrophyIcon } from 'lucide-react';
import { NoticeAlt } from './NoticeAlt';

const meta: Meta<typeof NoticeAlt> = {
  title: 'Elements/NoticeAlt',
  component: NoticeAlt,
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
      <div className="mx-auto w-full max-w-200">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof NoticeAlt>;

export const Warning: Story = {
  render: () => (
    <NoticeAlt
      variant="warning"
      title="Viewing previous version"
      action={
        <NoticeAlt.Button>
          Return to latest <ArrowRightIcon />
        </NoticeAlt.Button>
      }
    >
      <NoticeAlt.Message>Viewing version from Feb 12, 2026 at 7:38 AM</NoticeAlt.Message>
    </NoticeAlt>
  ),
};

export const Destructive: Story = {
  render: () => (
    <NoticeAlt
      variant="destructive"
      title="Failed to load"
      action={
        <NoticeAlt.Button>
          Retry <RefreshCwIcon />
        </NoticeAlt.Button>
      }
    >
      <NoticeAlt.Message>Failed to load the dataset. Check your connection and try again.</NoticeAlt.Message>
    </NoticeAlt>
  ),
};

export const MessageOnly: Story = {
  render: () => (
    <NoticeAlt variant="info" action={<NoticeAlt.Button>Define scorer</NoticeAlt.Button>}>
      <NoticeAlt.Message>No eligible scorers have been defined for this run.</NoticeAlt.Message>
    </NoticeAlt>
  ),
};

export const CustomIcon: Story = {
  render: () => (
    <NoticeAlt variant="success" title="Achievement unlocked" icon={<TrophyIcon />}>
      <NoticeAlt.Message>You completed every onboarding step.</NoticeAlt.Message>
    </NoticeAlt>
  ),
};

export const TintedBackgrounds: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <NoticeAlt surface="tinted" variant="success" title="Import complete">
        <NoticeAlt.Message>24 dataset items are ready to use.</NoticeAlt.Message>
      </NoticeAlt>
      <NoticeAlt surface="tinted" variant="info" title="Read-only dataset">
        <NoticeAlt.Message>Clone this dataset before making changes.</NoticeAlt.Message>
      </NoticeAlt>
      <NoticeAlt surface="tinted" variant="warning" title="Viewing previous version">
        <NoticeAlt.Message>You are viewing the version saved on Feb 12, 2026 at 7:38 AM.</NoticeAlt.Message>
      </NoticeAlt>
      <NoticeAlt surface="tinted" variant="destructive" title="Dataset unavailable">
        <NoticeAlt.Message>The dataset could not be loaded.</NoticeAlt.Message>
      </NoticeAlt>
      <NoticeAlt surface="tinted" variant="note" title="Before you continue">
        <NoticeAlt.Message>Changes apply to new runs only.</NoticeAlt.Message>
      </NoticeAlt>
    </div>
  ),
};

export const GrainyFadeBackgrounds: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <NoticeAlt surface="grainy-fade" variant="success" title="Import complete">
        <NoticeAlt.Message>24 dataset items are ready to use.</NoticeAlt.Message>
      </NoticeAlt>
      <NoticeAlt surface="grainy-fade" variant="info" title="Read-only dataset">
        <NoticeAlt.Message>Clone this dataset before making changes.</NoticeAlt.Message>
      </NoticeAlt>
      <NoticeAlt surface="grainy-fade" variant="warning" title="Viewing previous version">
        <NoticeAlt.Message>You are viewing the version saved on Feb 12, 2026 at 7:38 AM.</NoticeAlt.Message>
      </NoticeAlt>
      <NoticeAlt surface="grainy-fade" variant="destructive" title="Dataset unavailable">
        <NoticeAlt.Message>The dataset could not be loaded.</NoticeAlt.Message>
      </NoticeAlt>
      <NoticeAlt surface="grainy-fade" variant="note" title="Before you continue">
        <NoticeAlt.Message>Changes apply to new runs only.</NoticeAlt.Message>
      </NoticeAlt>
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <NoticeAlt
        variant="success"
        title="Import complete"
        action={
          <NoticeAlt.Button>
            View items <ArrowRightIcon />
          </NoticeAlt.Button>
        }
      >
        <NoticeAlt.Message>24 dataset items are ready to use.</NoticeAlt.Message>
      </NoticeAlt>
      <NoticeAlt
        variant="info"
        title="Read-only dataset"
        action={
          <NoticeAlt.Button>
            Clone dataset <CopyIcon />
          </NoticeAlt.Button>
        }
      >
        <NoticeAlt.Message>Clone this dataset before making changes.</NoticeAlt.Message>
      </NoticeAlt>
      <NoticeAlt variant="warning" title="Viewing previous version">
        <NoticeAlt.Message>You are viewing the version saved on Feb 12, 2026 at 7:38 AM.</NoticeAlt.Message>
      </NoticeAlt>
      <NoticeAlt
        variant="destructive"
        title="Dataset unavailable"
        action={
          <NoticeAlt.Button>
            Retry <RefreshCwIcon />
          </NoticeAlt.Button>
        }
      >
        <NoticeAlt.Message>The dataset could not be loaded.</NoticeAlt.Message>
      </NoticeAlt>
      <NoticeAlt variant="note" title="Before you continue">
        <NoticeAlt.Message>Changes apply to new runs only.</NoticeAlt.Message>
      </NoticeAlt>
    </div>
  ),
};
