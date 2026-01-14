import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from './EmptyState';
import { Button } from '../Button';
import { FileX, Inbox, Search, Users } from 'lucide-react';

const meta: Meta<typeof EmptyState> = {
  title: 'Feedback/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    iconSlot: <Inbox className="w-[126px] h-auto text-icon3" />,
    titleSlot: 'No items yet',
    descriptionSlot: 'Get started by creating your first item.',
    actionSlot: <Button>Create Item</Button>,
  },
};

export const NoResults: Story = {
  args: {
    iconSlot: <Search className="w-[126px] h-auto text-icon3" />,
    titleSlot: 'No results found',
    descriptionSlot: 'Try adjusting your search or filters to find what you are looking for.',
    actionSlot: <Button variant="outline">Clear filters</Button>,
  },
};

export const NoFiles: Story = {
  args: {
    iconSlot: <FileX className="w-[126px] h-auto text-icon3" />,
    titleSlot: 'No files',
    descriptionSlot: 'Upload your first file to get started.',
    actionSlot: <Button>Upload File</Button>,
  },
};

export const NoTeamMembers: Story = {
  args: {
    iconSlot: <Users className="w-[126px] h-auto text-icon3" />,
    titleSlot: 'No team members',
    descriptionSlot: 'Invite your team members to collaborate on this project.',
    actionSlot: <Button>Invite Members</Button>,
  },
};

export const WithoutAction: Story = {
  args: {
    iconSlot: <Inbox className="w-[126px] h-auto text-icon3" />,
    titleSlot: 'All caught up!',
    descriptionSlot: 'You have no pending notifications.',
    actionSlot: null,
  },
};

export const CustomHeading: Story = {
  args: {
    as: 'h1',
    iconSlot: <Inbox className="w-[126px] h-auto text-icon3" />,
    titleSlot: 'Welcome to the App',
    descriptionSlot: 'This is your dashboard. Start by exploring the features.',
    actionSlot: <Button>Get Started</Button>,
  },
};
