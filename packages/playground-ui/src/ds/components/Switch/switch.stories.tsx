import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from './switch';
import { Label } from '../Label';

const meta: Meta<typeof Switch> = {
  title: 'Elements/Switch',
  component: Switch,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: { type: 'boolean' },
    },
    checked: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  args: {},
};

export const Checked: Story = {
  args: {
    checked: true,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const DisabledChecked: Story = {
  args: {
    disabled: true,
    checked: true,
  },
};

export const WithLabel: Story = {
  render: args => (
    <div className="flex items-center gap-2">
      <Switch id="notifications" {...args} />
      <Label htmlFor="notifications" className="text-neutral6">
        Enable notifications
      </Label>
    </div>
  ),
};

export const SettingsList: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-[300px]">
      <div className="flex items-center justify-between">
        <Label htmlFor="email" className="text-neutral6">
          Email notifications
        </Label>
        <Switch id="email" defaultChecked />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="push" className="text-neutral6">
          Push notifications
        </Label>
        <Switch id="push" />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="sms" className="text-neutral6">
          SMS notifications
        </Label>
        <Switch id="sms" disabled />
      </div>
    </div>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <div className="flex items-start justify-between gap-4 w-[350px]">
      <div className="flex flex-col gap-1">
        <Label htmlFor="dark-mode" className="text-neutral6">
          Dark mode
        </Label>
        <span className="text-xs text-neutral3">Switch to a darker color scheme</span>
      </div>
      <Switch id="dark-mode" />
    </div>
  ),
};
