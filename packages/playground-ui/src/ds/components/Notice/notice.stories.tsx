import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ArrowRightIcon,
  RefreshCwIcon,
  CopyIcon,
  TriangleAlertIcon,
  OctagonAlertIcon,
  InfoIcon,
  TrophyIcon,
} from 'lucide-react';
import { Notice } from './Notice';

const meta: Meta<typeof Notice> = {
  title: 'Elements/Notice',
  component: Notice,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['warning', 'destructive', 'success', 'info'],
    },
  },
  decorators: [
    Story => (
      <div style={{ width: 800 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Notice>;

export const Warning: Story = {
  render: () => (
    <Notice variant="warning">
      <TriangleAlertIcon />
      <Notice.Message>Viewing version from Feb 12, 2026 at 7:38 AM</Notice.Message>
      <Notice.Button>
        Return to latest <ArrowRightIcon />
      </Notice.Button>
    </Notice>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Notice variant="destructive">
      <OctagonAlertIcon />
      <Notice.Message>Failed to load dataset. Please try again.</Notice.Message>
      <Notice.Button>
        Retry <RefreshCwIcon />
      </Notice.Button>
    </Notice>
  ),
};

export const Success: Story = {
  render: () => (
    <Notice variant="success">
      <Notice.Message>Dataset successfully imported. 24 items added.</Notice.Message>
      <Notice.Button>
        View items <ArrowRightIcon />
      </Notice.Button>
    </Notice>
  ),
};

export const Info: Story = {
  render: () => (
    <Notice variant="info">
      <InfoIcon />
      <Notice.Message>This dataset is read-only. Clone it to make changes.</Notice.Message>
      <Notice.Button>
        Clone dataset <CopyIcon />
      </Notice.Button>
    </Notice>
  ),
};

export const WithoutButton: Story = {
  render: () => (
    <Notice variant="warning">
      <Notice.Message>This is a notice without an action button.</Notice.Message>
    </Notice>
  ),
};

export const WithTitleAndColumn: Story = {
  render: () => (
    <Notice variant="destructive">
      <OctagonAlertIcon />
      <Notice.Column>
        <Notice.Title>Error loading comparison</Notice.Title>
        <Notice.Message>The requested resource could not be found. Please try again later.</Notice.Message>
      </Notice.Column>
    </Notice>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Notice variant="warning">
        <TriangleAlertIcon />
        <Notice.Message>Viewing version from Feb 12, 2026 at 7:38 AM</Notice.Message>
        <Notice.Button>
          Return to latest <ArrowRightIcon />
        </Notice.Button>
      </Notice>
      <Notice variant="destructive">
        <OctagonAlertIcon />
        <Notice.Message>Failed to load dataset. Please try again.</Notice.Message>
        <Notice.Button>
          Retry <RefreshCwIcon />
        </Notice.Button>
      </Notice>
      <Notice variant="success">
        <TrophyIcon />
        <Notice.Message>Dataset successfully imported. 24 items added.</Notice.Message>
        <Notice.Button>
          View items <ArrowRightIcon />
        </Notice.Button>
      </Notice>
      <Notice variant="info">
        <InfoIcon />
        <Notice.Message>This dataset is read-only. Clone it to make changes.</Notice.Message>
        <Notice.Button>
          Clone dataset <CopyIcon />
        </Notice.Button>
      </Notice>
    </div>
  ),
};
