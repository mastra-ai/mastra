import type { Meta, StoryObj } from '@storybook/react-vite';

import { TooltipProvider } from '../Tooltip';
import { ThinkingLevelUnavailable } from './thinking-level-picker';
import { ALL_LEVELS } from './thinking-level-story-data';

const meta: Meta<typeof ThinkingLevelUnavailable> = {
  title: 'Elements/ThinkingLevel/Unavailable',
  component: ThinkingLevelUnavailable,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ThinkingLevelUnavailable>;

export const Locked: Story = {
  render: () => (
    <ThinkingLevelUnavailable
      options={ALL_LEVELS}
      value="high"
      label="Thinking"
      reason="An admin locked the model for this session."
    />
  ),
};

export const Unsupported: Story = {
  render: () => (
    <ThinkingLevelUnavailable options={ALL_LEVELS} label="Thinking" reason="GPT-4o mini has no thinking levels" />
  ),
};
