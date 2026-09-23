import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inbox } from 'lucide-react';
import { Button } from '../Button';
import { EmptyState } from './EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'Feedback/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    titleSlot: 'No items yet',
    descriptionSlot: 'Get started by creating your first item.',
    actionSlot: <Button>Create Item</Button>,
  },
};

export const NoResults: Story = {
  args: {
    titleSlot: 'No results found',
    descriptionSlot: 'Try adjusting your search or filters to find what you are looking for.',
    actionSlot: <Button variant="outline">Clear filters</Button>,
  },
};

export const NoFiles: Story = {
  args: {
    titleSlot: 'No files',
    descriptionSlot: 'Upload your first file to get started.',
    actionSlot: <Button>Upload File</Button>,
  },
};

export const NoTeamMembers: Story = {
  args: {
    titleSlot: 'No team members',
    descriptionSlot: 'Invite your team members to collaborate on this project.',
    actionSlot: <Button>Invite Members</Button>,
  },
};

export const WithoutAction: Story = {
  args: {
    titleSlot: 'All caught up!',
    descriptionSlot: 'You have no pending notifications.',
    actionSlot: null,
  },
};

export const CustomHeading: Story = {
  args: {
    as: 'h1',
    iconSlot: <Inbox className="h-auto w-[126px] text-muted-foreground" />,
    titleSlot: 'Welcome to the App',
    descriptionSlot: 'This is your dashboard. Start by exploring the features.',
    actionSlot: <Button>Get Started</Button>,
  },
};

export const Fill: Story = {
  parameters: { layout: 'fullscreen' },
  args: {
    titleSlot: 'Your inbox is empty',
    descriptionSlot: 'The fill variant centers the block in the full height of its parent.',
    actionSlot: <Button variant="outline">Go to traces</Button>,
    variant: 'fill',
  },
  render: args => (
    <div className="h-120 border border-dashed border-border">
      <EmptyState {...args} />
    </div>
  ),
};

export const ErrorTone: Story = {
  args: {
    tone: 'error',
    titleSlot: 'Unable to load traces',
    descriptionSlot: 'The observability store did not respond. Check the connection and try again.',
    actionSlot: <Button>Try again</Button>,
  },
};
