import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Button } from '../Button';
import { ButtonsGroup } from '../ButtonsGroup';
import { TooltipProvider } from '../Tooltip';
import { Txt } from '../Txt';
import { ThinkingLevelPicker } from './thinking-level-picker';
import {
  ALL_LEVELS,
  DESCRIPTION,
  LOW_HIGH_LEVELS,
  SONNET_LEVELS,
  UP_TO_HIGH_LEVELS,
} from './thinking-level-story-data';
import type { Level } from './thinking-level-story-data';
import type { ThinkingLevelOption } from './use-thinking-level-stop';
import { IconChevronBottom } from '@/ds/icons/central/IconChevronBottom';

const meta: Meta<typeof ThinkingLevelPicker> = {
  title: 'Elements/ThinkingLevel/Picker',
  component: ThinkingLevelPicker,
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
type Story = StoryObj<typeof ThinkingLevelPicker>;

function ControlledPicker({ options, initial }: { options: ThinkingLevelOption<Level>[]; initial: Level }) {
  const [value, setValue] = useState(initial);
  return (
    <ThinkingLevelPicker
      options={options}
      value={value}
      label="Thinking"
      description={DESCRIPTION}
      onChange={setValue}
    />
  );
}

export const Default: Story = {
  render: () => <ControlledPicker options={ALL_LEVELS} initial="medium" />,
};

export const FewerLevels: Story = {
  render: () => <ControlledPicker options={LOW_HIGH_LEVELS} initial="high" />,
};

export const FollowingADefault: Story = {
  render: function Render() {
    const inherited: Level = 'medium';
    const [override, setOverride] = useState<Level>();
    return (
      <ThinkingLevelPicker
        options={ALL_LEVELS}
        value={override ?? inherited}
        label="Thinking"
        origin={override ? 'this session' : 'build mode default'}
        footer={
          <div className="flex items-center justify-between gap-3">
            <Txt as="p" variant="caption" tone="muted">
              {override ? 'Set for this session.' : 'Follows the build mode default.'}
            </Txt>
            {override ? (
              <Button variant="ghost" size="sm" onClick={() => setOverride(undefined)}>
                Use default
              </Button>
            ) : null}
          </div>
        }
        onChange={setOverride}
      />
    );
  },
};

export const Unavailable: Story = {
  render: () => (
    <ThinkingLevelPicker
      options={ALL_LEVELS}
      value="off"
      label="Thinking"
      unavailableReason="Claude 3.5 Haiku has no thinking levels"
      onChange={() => {}}
    />
  ),
};

function GroupedWithModel({ model, options, initial, unavailableReason }: GroupedWithModelProps) {
  const [value, setValue] = useState(initial);
  return (
    <ButtonsGroup size="sm" aria-label="Model and thinking">
      <Button variant="ghost" size="sm">
        {model}
        <IconChevronBottom aria-hidden size={12} />
      </Button>
      <ThinkingLevelPicker
        options={options}
        value={value}
        label="Thinking"
        unavailableReason={unavailableReason}
        description={DESCRIPTION}
        onChange={setValue}
      />
    </ButtonsGroup>
  );
}

interface GroupedWithModelProps {
  model: string;
  options: ThinkingLevelOption<Level>[];
  initial: Level;
  unavailableReason?: string;
}

export const GroupedWithModelPicker: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <GroupedWithModel model="Claude Sonnet 4.6" options={SONNET_LEVELS} initial="medium" />
      <GroupedWithModel model="GPT-5" options={UP_TO_HIGH_LEVELS} initial="high" />
      <GroupedWithModel
        model="GPT-4o mini"
        options={ALL_LEVELS}
        initial="off"
        unavailableReason="GPT-4o mini has no thinking levels"
      />
    </div>
  ),
};
