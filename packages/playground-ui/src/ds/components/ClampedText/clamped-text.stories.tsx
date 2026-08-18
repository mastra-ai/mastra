import type { Meta, StoryObj } from '@storybook/react-vite';
import { ClampedText } from './clamped-text';

const meta: Meta<typeof ClampedText> = {
  title: 'Elements/ClampedText',
  component: ClampedText,
  decorators: [
    Story => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ClampedText>;

const longText =
  'Create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness. Pass the full task list each time this tool is called.';

export const Default: Story = {
  args: {
    children: longText,
    variant: 'ui-sm',
    className: 'text-neutral3',
  },
};

export const ShortTextNoToggle: Story = {
  args: {
    children: 'Short text that fits within the clamp — no toggle shown.',
    variant: 'ui-sm',
    className: 'text-neutral3',
  },
};

export const ThreeLines: Story = {
  args: {
    children: longText,
    lines: 3,
    variant: 'ui-sm',
    className: 'text-neutral3',
  },
};
