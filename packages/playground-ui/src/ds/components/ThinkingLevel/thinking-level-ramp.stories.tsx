import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { ThinkingLevelRamp } from './thinking-level-ramp';
import { ALL_LEVELS, LOW_HIGH_LEVELS } from './thinking-level-story-data';
import type { Level } from './thinking-level-story-data';

const meta: Meta<typeof ThinkingLevelRamp> = {
  title: 'Elements/ThinkingLevel/Ramp',
  component: ThinkingLevelRamp,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    Story => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ThinkingLevelRamp>;

function ControlledRamp({ initial = 'medium', slowSave }: { initial?: Level; slowSave?: boolean }) {
  const [value, setValue] = useState<Level>(initial);
  const change = async (next: Level) => {
    if (slowSave) {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 1500);
      await promise;
    }
    setValue(next);
  };
  return <ThinkingLevelRamp options={ALL_LEVELS} value={value} label="Thinking" onChange={change} />;
}

export const Default: Story = {
  render: () => <ControlledRamp />,
};

export const FewerLevels: Story = {
  render: function Render() {
    const [value, setValue] = useState<Level>('high');
    return <ThinkingLevelRamp options={LOW_HIGH_LEVELS} value={value} label="Thinking" onChange={setValue} />;
  },
};

export const SetAboveADefault: Story = {
  render: function Render() {
    const inherited: Level = 'medium';
    const [override, setOverride] = useState<Level | undefined>('high');
    return (
      <ThinkingLevelRamp
        options={ALL_LEVELS}
        value={override ?? inherited}
        label="Thinking"
        onChange={setOverride}
        reset={override ? { label: 'Use default', onClick: () => setOverride(undefined) } : undefined}
      />
    );
  },
};

export const SlowSave: Story = {
  render: () => <ControlledRamp slowSave />,
};

export const Loading: Story = {
  render: () => (
    <ThinkingLevelRamp options={ALL_LEVELS} value={undefined} label="Thinking" loading onChange={() => {}} />
  ),
};

export const Unavailable: Story = {
  render: () => (
    <ThinkingLevelRamp
      options={ALL_LEVELS}
      value={undefined}
      label="Thinking"
      unavailableReason="The thinking level couldn't be loaded."
      onChange={() => {}}
    />
  ),
};
