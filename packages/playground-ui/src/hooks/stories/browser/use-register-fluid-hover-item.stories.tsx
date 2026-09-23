import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { FluidHoverHighlight } from '@/components/fluid-hover-highlight';
import { Checkbox } from '@/ds/components/Checkbox';
import { Txt } from '@/ds/components/Txt';
import { useFluidHover, useRegisterFluidHoverItem } from '@/hooks/use-fluid-hover';
import type { UseFluidHoverReturn } from '@/hooks/use-fluid-hover';

const steps = ['Fetch weather', 'Summarize forecast', 'Send notification'];

function StepRow({
  label,
  index,
  registerItem,
}: {
  label: string;
  index: number | undefined;
  registerItem: UseFluidHoverReturn['registerItem'];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useRegisterFluidHoverItem(registerItem, index, ref);
  return (
    <div ref={ref} className={index === undefined ? 'px-3 py-2 text-muted-foreground' : 'px-3 py-2'}>
      <Txt>{label}</Txt>
    </div>
  );
}

function RegisterFluidHoverItemDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hover = useFluidHover(containerRef);
  const [middleRegistered, setMiddleRegistered] = useState(true);
  return (
    <HookDemo>
      <label className="flex items-center gap-2">
        <Checkbox checked={middleRegistered} onCheckedChange={checked => setMiddleRegistered(checked === true)} />
        <Txt>Register “{steps[1]}”</Txt>
      </label>
      <div
        ref={containerRef}
        {...hover.handlers}
        className="relative isolate flex max-w-80 flex-col gap-1 rounded-xl border border-border p-3"
      >
        <FluidHoverHighlight hover={hover} className="-z-1 rounded-lg bg-fill" />
        {steps.map((label, index) => (
          <StepRow
            key={label}
            label={label}
            index={index === 1 && !middleRegistered ? undefined : index}
            registerItem={hover.registerItem}
          />
        ))}
      </div>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useRegisterFluidHoverItem',
  component: RegisterFluidHoverItemDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Registers a row with a `useFluidHover` list while it is mounted. Pass `undefined` as the index or `registerItem` to render the row outside the list: the highlight skips it. Import from `@mastra/playground-ui/hooks/use-fluid-hover`.',
      },
    },
  },
} satisfies Meta<typeof RegisterFluidHoverItemDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
