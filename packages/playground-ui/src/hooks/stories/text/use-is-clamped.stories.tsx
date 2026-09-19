import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { useIsClamped } from '@/hooks/use-is-clamped';

function IsClampedDemo() {
  const [expanded, setExpanded] = useState(false);
  const { ref, isClamped } = useIsClamped<HTMLParagraphElement>({ enabled: !expanded });
  return (
    <HookDemo>
      <div className="max-w-80">
        <p ref={ref} className={expanded ? 'text-ui-md' : 'text-ui-md line-clamp-2'}>
          A trace can contain many spans, tool calls, and model responses. Keep the summary compact until someone wants
          to read every detail. Expanding this paragraph reveals the rest without losing the collapse control.
        </p>
      </div>
      <Txt role="status">Clipped when collapsed: {String(isClamped)}</Txt>
      {isClamped && (
        <Button onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : 'Read more'}</Button>
      )}
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useIsClamped',
  component: IsClampedDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Detects clipped content and remeasures on resize. Disable measurement while expanded to preserve whether a collapse control is needed. Import from `@mastra/playground-ui/hooks/use-is-clamped`.',
      },
    },
  },
} satisfies Meta<typeof IsClampedDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
