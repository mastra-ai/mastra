import type { Meta, StoryObj } from '@storybook/react-vite';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Txt } from '@/ds/components/Txt';
import { useClock } from '@/hooks/use-clock';

function ClockDemo() {
  const seconds = useClock(now => new Date(now).toLocaleTimeString());
  const minutes = useClock(now => new Date(now).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }));
  return (
    <HookDemo>
      <Txt role="status">
        Every second:{' '}
        <Txt as="span" font="mono">
          {seconds}
        </Txt>
      </Txt>
      <Txt>
        Every minute:{' '}
        <Txt as="span" font="mono">
          {minutes}
        </Txt>
      </Txt>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useClock',
  component: ClockDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Reads the current time through `read` on one shared clock that ticks every second, and re-renders only when the value `read` returns changes. Import from `@mastra/playground-ui/hooks/use-clock`.',
      },
    },
  },
} satisfies Meta<typeof ClockDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
