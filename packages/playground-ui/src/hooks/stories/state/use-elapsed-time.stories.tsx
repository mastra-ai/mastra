import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { useElapsedTime } from '@/hooks/use-elapsed-time';
import { formatElapsed } from '@/utils/duration';

function ElapsedTimeDemo() {
  const [isActive, setIsActive] = useState(false);
  const elapsed = useElapsedTime(isActive);
  return (
    <HookDemo>
      <Txt>{formatElapsed(elapsed)}</Txt>
      <Button onClick={() => setIsActive(active => !active)}>{isActive ? 'Stop' : 'Start'}</Button>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useElapsedTime',
  component: ElapsedTimeDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Returns the milliseconds elapsed while active, refreshed every 100ms. Pair with `formatElapsed` for display. Import from `@mastra/playground-ui/hooks/use-elapsed-time`.',
      },
    },
  },
} satisfies Meta<typeof ElapsedTimeDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
