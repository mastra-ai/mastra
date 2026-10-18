import type { Meta, StoryObj } from '@storybook/react-vite';
import { Settings, Bell, Plus, Search } from 'lucide-react';
import { Button } from '../Button';
import { Txt } from '../Txt';
import { Header, HeaderTitle, HeaderAction, HeaderGroup } from './Header';
import { MainCard } from '@/ds/new/layout/app-shell/main-card';

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
  args: { border: true },
  render: args => (
    <Header {...args}>
      <HeaderTitle>Dashboard</HeaderTitle>
    </Header>
  ),
};

export const InFrame: Story = {
  args: { border: true },
  render: args => (
    <div className="bg-sidebar p-4">
      <MainCard className="min-h-48">
        <Header {...args}>
          <HeaderTitle>App frame header</HeaderTitle>
        </Header>
        <div className="p-4">
          <Txt variant="body-sm" tone="muted">
            The header uses the same surface rim as the frame. MainCard reserves its inset pixel.
          </Txt>
        </div>
      </MainCard>
    </div>
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
        <span className="text-body text-muted-foreground">12 total</span>
      </HeaderGroup>
      <HeaderAction>
        <Button size="md">
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
