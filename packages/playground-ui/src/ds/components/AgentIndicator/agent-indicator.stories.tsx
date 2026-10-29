import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { Txt } from '../Txt';

import { AgentIndicator } from './agent-indicator';
import { agentIndicatorStates } from './poses';
import type { AgentIndicatorState } from './poses';

const meta: Meta<typeof AgentIndicator> = {
  title: 'Elements/AgentIndicator',
  component: AgentIndicator,
  parameters: {
    layout: 'centered',
  },
  args: {
    state: 'thinking',
    className: 'size-24',
  },
  argTypes: {
    state: {
      control: { type: 'radio' },
      options: agentIndicatorStates,
    },
  },
};

export default meta;
type Story = StoryObj<typeof AgentIndicator>;

export const Default: Story = {};

export const AllStates: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-8">
      {agentIndicatorStates.map(state => (
        <div key={state} className="flex flex-col items-center gap-2">
          <AgentIndicator state={state} className="size-12" />
          <Txt variant="caption" tone="muted">
            {state}
          </Txt>
        </div>
      ))}
    </div>
  ),
};

const RUN_START: [AgentIndicatorState, number] = ['idle', 1500];
const RUN: [AgentIndicatorState, number][] = [
  RUN_START,
  ['thinking', 5000],
  ['searching', 2500],
  ['tool', 2500],
  ['memory', 2500],
  ['writing', 5200],
  ['waiting', 2500],
  ['done', 2000],
  ['error', 2000],
];

function Run({ className }: { className?: string }) {
  const [step, setStep] = useState(0);
  const [state, hold] = RUN[step] ?? RUN_START;

  useEffect(() => {
    const timer = setTimeout(() => setStep(current => (current + 1) % RUN.length), hold);
    return () => clearTimeout(timer);
  }, [hold, step]);

  return (
    <div className="flex flex-col items-center gap-3">
      <AgentIndicator state={state} className={className} />
      <Txt variant="caption" tone="muted">
        {state}
      </Txt>
    </div>
  );
}

export const ThroughARun: Story = {
  render: args => <Run className={args.className} />,
};
