import type { Meta, StoryObj } from '@storybook/react-vite';

import { Txt } from '../Txt';
import { ThinkingLevelIcon } from './thinking-level-icon';
import { ALL_LEVELS, LOW_HIGH_LEVELS } from './thinking-level-story-data';

const meta: Meta<typeof ThinkingLevelIcon> = {
  title: 'Elements/ThinkingLevel/Icon',
  component: ThinkingLevelIcon,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ThinkingLevelIcon>;

export const EveryLevel: Story = {
  render: () => (
    <div className="grid grid-cols-[auto_auto] items-center gap-x-4 gap-y-2">
      {ALL_LEVELS.map(level => (
        <div key={level.value} className="contents">
          <Txt as="span" variant="caption" tone="muted">
            {level.label}
          </Txt>
          <ThinkingLevelIcon options={ALL_LEVELS} value={level.value} />
        </div>
      ))}
    </div>
  ),
};

export const FewerLevels: Story = {
  render: () => <ThinkingLevelIcon options={LOW_HIGH_LEVELS} value="low" />,
};

export const Loading: Story = {
  render: () => <ThinkingLevelIcon options={ALL_LEVELS} value={undefined} loading />,
};
