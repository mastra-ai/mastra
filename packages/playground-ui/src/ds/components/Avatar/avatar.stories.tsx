import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './Avatar';
import { CompositeAvatar } from './composite-avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Elements/Avatar',
  component: Avatar,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'md', 'lg', 'control'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  args: {
    name: 'John Doe',
    size: 'sm',
  },
};

export const WithImage: Story = {
  args: {
    name: 'Jane Smith',
    src: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    size: 'md',
  },
};

export const Small: Story = {
  args: {
    name: 'Alice',
    size: 'sm',
  },
};

export const Medium: Story = {
  args: {
    name: 'Bob',
    size: 'md',
  },
};

export const Large: Story = {
  args: {
    name: 'Charlie',
    size: 'lg',
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar name="Small" size="sm" />
      <Avatar name="Medium" size="md" />
      <Avatar name="Large" size="lg" />
    </div>
  ),
};

export const CompositeDark: Story = {
  globals: { theme: 'dark' },
  render: () => (
    <CompositeAvatar badge={<Avatar name="Mastra" size="xs" />}>
      <Avatar name="Justin Levine" size="sm" />
    </CompositeAvatar>
  ),
};

export const CompositeLight: Story = {
  ...CompositeDark,
  globals: { theme: 'light' },
};

export const CompositeWithImages: Story = {
  render: () => (
    <CompositeAvatar
      badge={
        <Avatar
          name="Mastra"
          size="xs"
          src="https://app.paper.design/file-assets/01M3ZEJQE1FBY8QS12PDAP7EAD/2HJ0BRDHF4SC53J60Z9SPYRCWJ.svg"
        />
      }
    >
      <Avatar
        name="Justin Levine"
        size="sm"
        src="https://app.paper.design/file-assets/01M3ZEJQE1FBY8QS12PDAP7EAD/1BJ2ESN9ZCN5BC6T2NEBFW90AE.png"
      />
    </CompositeAvatar>
  ),
};
