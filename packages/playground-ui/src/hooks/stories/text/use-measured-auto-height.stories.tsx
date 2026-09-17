import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import { useMeasuredAutoHeight } from '@/hooks/use-measured-auto-height';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Txt } from '@/ds/components/Txt';

function MeasuredAutoHeightDemo() {
  const [expanded, setExpanded] = useState(false);
  const { ref, height, heightStyle, measure } = useMeasuredAutoHeight();
  return (
    <HookDemo>
      <Button onClick={() => setExpanded(value => !value)}>{expanded ? 'Collapse details' : 'Expand details'}</Button>
      <div
        style={heightStyle}
        className="border-border1 overflow-hidden rounded-lg border motion-safe:transition-[height] motion-safe:duration-200"
      >
        <div ref={ref} className="space-y-4 p-4">
          <Txt>Workflow run details</Txt>
          {expanded && (
            <Txt>
              The content grows naturally. ResizeObserver updates the measured height, and the outer container follows
              it. Reduced motion disables the transition.
            </Txt>
          )}
        </div>
      </div>
      <Txt role="status">Measured height: {height === null ? 'not measured yet' : `${height}px`}</Txt>
      <Button onClick={() => measure()}>Measure again</Button>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useMeasuredAutoHeight',
  component: MeasuredAutoHeightDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Measures content with a callback ref and ResizeObserver, returning a height style and an explicit measure function. Import from `@mastra/playground-ui/hooks/use-measured-auto-height`.',
      },
    },
  },
} satisfies Meta<typeof MeasuredAutoHeightDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
