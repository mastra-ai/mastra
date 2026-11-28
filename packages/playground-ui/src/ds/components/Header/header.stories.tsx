import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from '../Txt';
import { Header, HeaderTitle } from './Header';
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

export const NoBorder: Story = {
  render: () => (
    <Header border={false}>
      <HeaderTitle>Settings</HeaderTitle>
    </Header>
  ),
};
