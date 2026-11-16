import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import { ActivityStretchLine } from './activity-stretch-line';
import type { ActivityCall, ActivityCallStatus } from './model/activity-members';
import { ActivityWorkingDirectory } from '@/ds/components/ai/activity';
import { Button } from '@/ds/components/Button';

const meta: Meta<typeof ActivityStretchLine> = {
  title: 'AI/ActivityStretchLine',
  component: ActivityStretchLine,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof ActivityStretchLine>;

const WORKSPACE = '/sandboxes/7b45/mastra';

const CALLS = [
  { key: 'search', toolName: 'grep', args: { pattern: '^export class (Agent|DurableAgent|MessageList)' } },
  { key: 'read', toolName: 'view', args: { path: `${WORKSPACE}/packages/core/src/agent/agent.ts` } },
  { key: 'run', toolName: 'execute_command', args: { command: `cd ${WORKSPACE} && git status --short` } },
];

function callsAt(step: number): ActivityCall[] {
  return CALLS.slice(0, step + 1).map((call, index) => {
    const status: ActivityCallStatus = index < step ? 'done' : 'running';
    return { kind: 'call', ...call, status, row: <p>{call.key}</p> };
  });
}

function settled(calls: ActivityCall[]): ActivityCall[] {
  return calls.map(call => ({ ...call, status: 'done' }));
}

function WalkingLine() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStep(current => Math.min(current + 1, CALLS.length)), 2200);
    return () => window.clearInterval(timer);
  }, []);

  const live = step < CALLS.length;
  const members = live ? callsAt(step) : settled(callsAt(CALLS.length - 1));
  return <ActivityStretchLine members={members} live={live} elapsedMs={live ? undefined : 6600} />;
}

function Replayable() {
  const [run, setRun] = useState(0);

  return (
    <ActivityWorkingDirectory path={WORKSPACE}>
      <div className="flex w-160 flex-col items-start gap-6">
        <WalkingLine key={run} />
        <Button onClick={() => setRun(current => current + 1)}>Replay</Button>
      </div>
    </ActivityWorkingDirectory>
  );
}

/** A live line writes itself in, rolls to each call it starts, then settles on what the stretch did. */
export const LiveWalk: Story = {
  render: () => <Replayable />,
};
