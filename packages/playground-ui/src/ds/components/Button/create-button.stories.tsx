import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { TooltipProvider } from '../Tooltip';
import { CreateButton } from './CreateButton';

const meta: Meta<typeof CreateButton> = {
  title: 'Elements/CreateButton',
  component: CreateButton,
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Hover to see the tooltip (text + `C` hint). Press `C` anywhere on the page to trigger `onClick` — check the Actions panel.',
      },
    },
  },
  args: {
    tooltip: 'Create a new agent',
    children: 'New agent',
    onClick: fn(() => console.log('CreateButton clicked')),
  },
};

export default meta;
type Story = StoryObj<typeof CreateButton>;

export const Default: Story = {};

export const Primary: Story = {
  args: { variant: 'primary' },
};

export const Disabled: Story = {
  args: { disabled: true },
  parameters: {
    docs: { description: { story: 'Pressing `C` does nothing while the button is disabled.' } },
  },
};

export const ShortcutDisabled: Story = {
  args: { shortcutEnabled: false },
  parameters: {
    docs: { description: { story: 'The button is clickable but `C` is not bound.' } },
  },
};

export const WithInput: Story = {
  render: args => (
    <div className="flex items-center gap-4">
      <input
        className="border-border1 bg-surface3 text-neutral6 rounded-md border px-2 py-1"
        placeholder="Type c here"
      />
      <CreateButton {...args} />
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Typing `c` inside the input does not trigger the shortcut.' } },
  },
};
