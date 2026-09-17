import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef } from 'react';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Txt } from '@/ds/components/Txt';
import { useInView } from '@/hooks/use-in-view';

function InViewDemo() {
  const root = useRef<HTMLDivElement>(null);
  const { inView, setRef } = useInView({ root });
  return (
    <HookDemo>
      <Txt role="status">Target is {inView ? 'visible' : 'outside the scroll viewport'}</Txt>
      <div
        ref={root}
        tabIndex={0}
        role="region"
        aria-label="Visibility scroll area"
        className="h-60 overflow-y-auto rounded-lg border border-border1 p-4"
      >
        <div className="flex h-80 items-start">
          <Txt>Scroll down to reveal the target.</Txt>
        </div>
        <div ref={setRef} className="bg-surface3 p-4">
          <Txt>Observed target</Txt>
        </div>
        <div className="h-80" />
      </div>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useInView',
  component: InViewDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Observes a callback-ref target against the browser viewport or a supplied scroll container. This example uses a custom root. Import from `@mastra/playground-ui/hooks/use-in-view`.',
      },
    },
  },
} satisfies Meta<typeof InViewDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
