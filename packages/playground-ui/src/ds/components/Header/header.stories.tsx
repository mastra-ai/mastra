import type { Meta, StoryObj } from '@storybook/react-vite';
import { Settings, Bell, Plus, Search } from 'lucide-react';
import { Button } from '../Button';
import { Header, HeaderTitle, HeaderAction, HeaderGroup } from './Header';

const meta: Meta<typeof Header> = {
  title: 'Layout/Header',
  component: Header,
  parameters: {
    layout: 'fullscreen',
  },
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
          <Search className="size-4" />
        </Button>
        <Button size="md">
          <Plus className="size-4" />
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
          <Settings className="size-4" />
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
          <Bell className="size-4" />
        </Button>
        <Button variant="ghost" size="md">
          <Settings className="size-4" />
        </Button>
        <Button size="md">
          <Plus className="size-4" />
          Create
        </Button>
      </HeaderAction>
    </Header>
  ),
};
