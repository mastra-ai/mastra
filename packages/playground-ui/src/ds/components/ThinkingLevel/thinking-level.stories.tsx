import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../Button';
import { ButtonsGroup } from '../ButtonsGroup';
import { TooltipProvider } from '../Tooltip';
import { ThinkingLevelPicker } from './thinking-level-picker';
import { ThinkingLevelRamp } from './thinking-level-ramp';
import { ThinkingLevelSlider } from './thinking-level-slider';
import type { ThinkingLevelOption } from './use-thinking-level-stop';

type Level = 'off' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

const ALL_LEVELS: ThinkingLevelOption<Level>[] = [
  { value: 'off', label: 'Off', emphasis: 'muted' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high', emphasis: 'warning' },
  { value: 'max', label: 'Max', emphasis: 'warning' },
];

const LOW_HIGH_LEVELS = ALL_LEVELS.filter(level => ['off', 'low', 'high'].includes(level.value));
const UP_TO_HIGH_LEVELS = ALL_LEVELS.filter(level => level.emphasis !== 'warning');
const SONNET_LEVELS = ALL_LEVELS.filter(level => level.value !== 'xhigh');

const DESCRIPTION = 'More thinking answers harder problems, slower and at a higher cost.';

const meta: Meta<typeof ThinkingLevelPicker> = {
  title: 'Elements/ThinkingLevel',
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

export const Picker: Story = {
  render: () => <ControlledPicker options={ALL_LEVELS} initial="medium" />,
};

export const PickerForModelWithFewerLevels: Story = {
  render: () => <ControlledPicker options={LOW_HIGH_LEVELS} initial="high" />,
};

export const PickerUnavailable: Story = {
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

function ControlledRamp() {
  const [value, setValue] = useState<Level>('medium');
  return (
    <div className="w-72">
      <ThinkingLevelRamp options={ALL_LEVELS} value={value} label="Thinking" onChange={setValue} />
    </div>
  );
}

export const Ramp: Story = {
  render: () => <ControlledRamp />,
};

function GroupedWithModel({ model, options, initial, unavailableReason }: GroupedWithModelProps) {
  const [value, setValue] = useState(initial);
  return (
    <ButtonsGroup size="sm" aria-label="Model and thinking">
      <Button variant="ghost" size="sm">
        {model}
        <ChevronDown aria-hidden size={12} />
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

function ControlledSlider({ slowWrite }: { slowWrite?: boolean }) {
  const [value, setValue] = useState<Level>('off');
  const change = async (next: Level) => {
    if (slowWrite) {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 1500);
      await promise;
    }
    setValue(next);
  };
  return <ThinkingLevelSlider options={ALL_LEVELS} value={value} ariaLabel="Thinking level" onChange={change} />;
}

export const Slider: Story = {
  render: () => <ControlledSlider />,
};

export const SliderHoldsUntilWriteLands: Story = {
  render: () => <ControlledSlider slowWrite />,
};

export const SliderInherited: Story = {
  render: () => (
    <ThinkingLevelSlider
      options={ALL_LEVELS}
      value="high"
      ariaLabel="Plan mode thinking level"
      valueTextSuffix=" · follows base"
      onChange={() => {}}
    />
  ),
};

export const SliderDisabled: Story = {
  render: () => (
    <ThinkingLevelSlider options={ALL_LEVELS} value="medium" ariaLabel="Thinking level" disabled onChange={() => {}} />
  ),
};
