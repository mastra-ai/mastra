import type { Meta, StoryObj } from '@storybook/react-vite';
import { PageHeader } from './page-header';
import { Bot, Workflow, Settings, Database } from 'lucide-react';

const meta: Meta<typeof PageHeader> = {
  title: 'Layout/PageHeader',
  component: PageHeader,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  args: {
    title: 'Page Title',
  },
};

export const WithDescription: Story = {
  args: {
    title: 'Agents',
    description: 'Create and manage AI agents for your workflows',
  },
};

export const WithIcon: Story = {
  args: {
    title: 'Agents',
    description: 'Create and manage AI agents for your workflows',
    icon: <Bot />,
  },
};

export const WorkflowHeader: Story = {
  args: {
    title: 'Workflows',
    description: 'Build and automate complex processes with visual workflows',
    icon: <Workflow />,
  },
};

export const SettingsHeader: Story = {
  args: {
    title: 'Settings',
    description: 'Configure your workspace preferences',
    icon: <Settings />,
  },
};

export const Loading: Story = {
  args: {
    title: 'loading',
    description: 'loading',
  },
};

export const TitleLoading: Story = {
  args: {
    title: 'loading',
    description: 'This description is already loaded',
  },
};

export const LongDescription: Story = {
  args: {
    title: 'Data Storage',
    description:
      'Configure your data storage settings including database connections, caching strategies, and backup schedules. These settings affect how your application stores and retrieves data.',
    icon: <Database />,
  },
};
