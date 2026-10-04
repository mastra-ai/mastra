import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inbox } from 'lucide-react';
import { Button } from '../Button';
import { EmptyStateIllustration } from './empty-state-illustration';
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
    actionSlot: <Button>Clear filters</Button>,
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
    iconSlot: <Inbox />,
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
    actionSlot: <Button>Go to traces</Button>,
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

export const Illustrated: Story = {
  args: {
    iconSlot: <EmptyStateIllustration name="traces" />,
    titleSlot: 'No traces yet',
    descriptionSlot: 'Traces appear here when your agents run.',
    actionSlot: <Button>Open setup</Button>,
  },
};

export const IllustratedError: Story = {
  args: {
    tone: 'error',
    iconSlot: <EmptyStateIllustration name="logs" />,
    titleSlot: 'Couldn’t load logs',
    descriptionSlot: 'The request timed out. Try again in a moment.',
    actionSlot: <Button>Retry</Button>,
  },
};

const illustrations = [
  ['traces', 'Traces'],
  ['logs', 'Logs'],
  ['api-keys', 'API keys'],
  ['environments', 'Environments'],
  ['requests', 'Requests'],
  ['databases', 'Databases'],
  ['threads', 'Threads'],
  ['deploys', 'Deploys'],
] as const;

export const AllIllustrations: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <div className="grid grid-cols-4 gap-8">
      {illustrations.map(([illustration, title]) => (
        <EmptyState
          key={illustration}
          iconSlot={<EmptyStateIllustration name={illustration} />}
          titleSlot={title}
          descriptionSlot="Deploy a project to see its history here."
          actionSlot={<Button>View projects</Button>}
        />
      ))}
    </div>
  ),
};

export const ErrorIllustrations: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <div className="grid grid-cols-3 gap-8">
      <EmptyState
        tone="error"
        iconSlot={<EmptyStateIllustration name="disconnected" />}
        titleSlot="Couldn’t load logs"
        descriptionSlot="Check your connection and try again."
        actionSlot={<Button>Retry</Button>}
      />
      <EmptyState
        tone="error"
        iconSlot={<EmptyStateIllustration name="locked" />}
        titleSlot="Couldn’t load API keys"
        descriptionSlot="You don’t have access to this. Ask an organization admin."
        actionSlot={<Button>Retry</Button>}
      />
      <EmptyState
        tone="error"
        iconSlot={<EmptyStateIllustration name="rate-limited" />}
        titleSlot="Couldn’t load requests"
        descriptionSlot="Too many requests. Wait a moment and try again."
        actionSlot={<Button>Retry</Button>}
      />
    </div>
  ),
};
