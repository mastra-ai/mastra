import type { Meta, StoryObj } from '@storybook/react-vite';
import { Label } from './label';
import { Input } from '../Input';

const meta: Meta<typeof Label> = {
  title: 'Elements/Label',
  component: Label,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  args: {
    children: 'Label',
  },
};

export const WithInput: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Label htmlFor="email">Email address</Label>
      <Input id="email" type="email" placeholder="email@example.com" />
    </div>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      <Label htmlFor="username">Username</Label>
      <span className="text-xs text-neutral3">Choose a unique username</span>
      <Input id="username" placeholder="@username" />
    </div>
  ),
};
