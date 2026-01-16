import type { Meta, StoryObj } from '@storybook/react-vite';
import { Breadcrumb, Crumb } from './Breadcrumb';
import { ChevronDown } from 'lucide-react';

const meta: Meta<typeof Breadcrumb> = {
  title: 'Navigation/Breadcrumb',
  component: Breadcrumb,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Breadcrumb>;

export const Default: Story = {
  render: () => (
    <Breadcrumb label="Navigation">
      <Crumb as="a" to="/home">
        Home
      </Crumb>
      <Crumb as="a" to="/products">
        Products
      </Crumb>
      <Crumb as="span" to="/products/item" isCurrent>
        Item Details
      </Crumb>
    </Breadcrumb>
  ),
};

export const TwoLevels: Story = {
  render: () => (
    <Breadcrumb label="Navigation">
      <Crumb as="a" to="/dashboard">
        Dashboard
      </Crumb>
      <Crumb as="span" to="/dashboard/settings" isCurrent>
        Settings
      </Crumb>
    </Breadcrumb>
  ),
};

export const ManyLevels: Story = {
  render: () => (
    <Breadcrumb label="Navigation">
      <Crumb as="a" to="/home">
        Home
      </Crumb>
      <Crumb as="a" to="/workspace">
        Workspace
      </Crumb>
      <Crumb as="a" to="/workspace/projects">
        Projects
      </Crumb>
      <Crumb as="a" to="/workspace/projects/mastra">
        Mastra
      </Crumb>
      <Crumb as="span" to="/workspace/projects/mastra/agents" isCurrent>
        Agents
      </Crumb>
    </Breadcrumb>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Breadcrumb label="Navigation">
      <Crumb as="a" to="/agents">
        Agents
      </Crumb>
      <Crumb
        as="span"
        to="/agents/my-agent"
        isCurrent
        action={
          <button className="p-1 hover:bg-surface2 rounded">
            <ChevronDown className="h-4 w-4 text-neutral3" />
          </button>
        }
      >
        My Agent
      </Crumb>
    </Breadcrumb>
  ),
};

export const SingleItem: Story = {
  render: () => (
    <Breadcrumb label="Navigation">
      <Crumb as="span" to="/dashboard" isCurrent>
        Dashboard
      </Crumb>
    </Breadcrumb>
  ),
};
