import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { useTimeDiff } from '@/hooks/use-time-diff';

function TimeDiffDemo() {
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [endedAt, setEndedAt] = useState<number | undefined>(undefined);
  const elapsed = useTimeDiff({ startedAt, endedAt });
  return (
    <HookDemo>
      <Txt role="status">Elapsed: {(elapsed / 1000).toFixed(1)}s</Txt>
      <Button onClick={() => setEndedAt(Date.now())} disabled={endedAt != null}>
        Stop
      </Button>
      <Button
        onClick={() => {
          setStartedAt(Date.now());
          setEndedAt(undefined);
        }}
      >
        Restart
      </Button>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useTimeDiff',
  component: TimeDiffDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Returns the milliseconds elapsed since `startedAt`, ticking every 100ms until `endedAt` is set. Import from `@mastra/playground-ui/hooks/use-time-diff`.',
      },
    },
  },
} satisfies Meta<typeof TimeDiffDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
