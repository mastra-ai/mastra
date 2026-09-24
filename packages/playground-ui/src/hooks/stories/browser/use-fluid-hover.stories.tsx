import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { FluidHoverHighlight } from '@/components/fluid-hover-highlight';
import { Txt } from '@/ds/components/Txt';
import { useFluidHover, useRegisterFluidHoverItem } from '@/hooks/use-fluid-hover';
import type { UseFluidHoverReturn } from '@/hooks/use-fluid-hover';

const agents = ['Weather agent', 'Research agent', 'Support agent', 'Billing agent'];

function AgentRow({
  name,
  index,
  registerItem,
  onPick,
}: {
  name: string;
  index: number;
  registerItem: UseFluidHoverReturn['registerItem'];
  onPick: (name: string) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useRegisterFluidHoverItem(registerItem, index, ref);
  return (
    <button ref={ref} type="button" className="rounded-lg px-3 py-2 text-left text-body" onClick={() => onPick(name)}>
      {name}
    </button>
  );
}

function FluidHoverDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hover = useFluidHover(containerRef);
  const [picked, setPicked] = useState<string>();
  return (
    <HookDemo>
      <div
        ref={containerRef}
        {...hover.handlers}
        className="relative isolate flex max-w-80 flex-col gap-3 rounded-xl border border-border p-3"
      >
        <FluidHoverHighlight hover={hover} className="-z-1 rounded-lg bg-fill" />
        {agents.map((name, index) => (
          <AgentRow key={name} name={name} index={index} registerItem={hover.registerItem} onPick={setPicked} />
        ))}
      </div>
      <Txt role="status">
        Highlighted: {hover.activeIndex === null ? 'none' : agents[hover.activeIndex]} · Clicked: {picked ?? 'none'}
      </Txt>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useFluidHover',
  component: FluidHoverDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Drives one highlight surface that travels between the rows of a list. The pointer lights the nearest row, so gaps and padding never go dark, and a click in a gap reaches the lit row. Render `FluidHoverHighlight` with the returned state. Import from `@mastra/playground-ui/hooks/use-fluid-hover`.',
      },
    },
  },
} satisfies Meta<typeof FluidHoverDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
