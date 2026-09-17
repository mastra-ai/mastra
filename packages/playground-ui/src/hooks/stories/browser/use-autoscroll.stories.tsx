import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { useAutoscroll } from '@/hooks/use-autoscroll';

function AutoscrollDemo({ enabled }: { enabled: boolean }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(12);
  useAutoscroll(viewport, { enabled });
  return (
    <HookDemo>
      <Txt>Scroll up, append a line, then return to the bottom and append again.</Txt>
      <div
        ref={viewport}
        tabIndex={0}
        role="log"
        aria-label="Streaming log"
        className="h-60 overflow-y-auto rounded-lg border border-border1 p-4"
      >
        {Array.from({ length: lineCount }, (_, index) => (
          <Txt key={index} font="mono">
            Log line {index + 1}
          </Txt>
        ))}
      </div>
      <Button onClick={() => setLineCount(count => count + 1)}>Append line</Button>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useAutoscroll',
  component: AutoscrollDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Follows new content while at the bottom. Scrolling upward pauses following; returning to the bottom resumes it. Import from `@mastra/playground-ui/hooks/use-autoscroll`.',
      },
    },
  },
  args: { enabled: true },
} satisfies Meta<typeof AutoscrollDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
