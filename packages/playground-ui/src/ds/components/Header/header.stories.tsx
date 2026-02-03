import type { Meta, StoryObj } from '@storybook/react-vite';
import { Header, HeaderTitle, HeaderAction, HeaderGroup } from './Header';
import { Button } from '../Button';
import { Settings, Bell, Plus, Search } from 'lucide-react';

const meta: Meta<typeof Header> = {
  title: 'Layout/Header',
  component: Header,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    border: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Header>;

export const Default: Story = {
  render: () => (
    <Header>
      <HeaderTitle>Dashboard</HeaderTitle>
    </Header>
  ),
};

export const WithActions: Story = {
  render: () => (
    <Header>
      <HeaderTitle>Agents</HeaderTitle>
      <HeaderAction>
        <Button variant="ghost" size="md">
          <Search className="h-4 w-4" />
        </Button>
        <Button size="md">
          <Plus className="h-4 w-4" />
          New Agent
        </Button>
      </HeaderAction>
    </Header>
  ),
};

export const WithGroup: Story = {
  render: () => (
    <Header>
      <HeaderGroup>
        <HeaderTitle>Workflows</HeaderTitle>
        <span className="text-sm text-neutral3">12 total</span>
      </HeaderGroup>
      <HeaderAction>
        <Button variant="outline" size="md">
          <Settings className="h-4 w-4" />
        </Button>
      </HeaderAction>
    </Header>
  ),
};

export const NoBorder: Story = {
  render: () => (
    <Header border={false}>
      <HeaderTitle>Settings</HeaderTitle>
    </Header>
  ),
};

export const ComplexHeader: Story = {
  render: () => (
    <Header>
      <HeaderGroup>
        <HeaderTitle>My Workspace</HeaderTitle>
      </HeaderGroup>
      <HeaderAction>
        <Button variant="ghost" size="md">
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="md">
          <Settings className="h-4 w-4" />
        </Button>
        <Button size="md">
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </HeaderAction>
    </Header>
  ),
};
