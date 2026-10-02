import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef } from 'react';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Txt } from '@/ds/components/Txt';
import { useIsomorphicLayoutEffect } from '@/hooks/use-isomorphic-layout-effect';

function IsomorphicLayoutEffectDemo({ progress }: { progress: number }) {
  const progressBar = useRef<HTMLProgressElement>(null);
  useIsomorphicLayoutEffect(() => {
    if (progressBar.current) progressBar.current.value = progress;
  }, [progress]);
  return (
    <HookDemo>
      <Txt as="label" htmlFor="layout-progress">
        Progress synchronized before paint: {progress}%
      </Txt>
      <progress id="layout-progress" ref={progressBar} max={100} className="w-full" />
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useIsomorphicLayoutEffect',
  component: IsomorphicLayoutEffectDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Uses useLayoutEffect in a browser and useEffect on the server. This canvas demonstrates DOM synchronization before paint; SSR is not simulated. Import from `@mastra/playground-ui/hooks/use-isomorphic-layout-effect`.',
      },
    },
  },
  args: { progress: 40 },
  argTypes: { progress: { control: { type: 'range', min: 0, max: 100, step: 1 } } },
} satisfies Meta<typeof IsomorphicLayoutEffectDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
