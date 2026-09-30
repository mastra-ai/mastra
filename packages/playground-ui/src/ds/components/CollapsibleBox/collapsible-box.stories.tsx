import type { Meta, StoryObj } from '@storybook/react-vite';
import { Maximize2, Minimize2 } from 'lucide-react';
import { CollapsibleBox } from './collapsible-box';
import { useCollapsibleBox } from './use-collapsible-box';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

function Demo({ paragraphs, collapsedHeight }: { paragraphs: number; collapsedHeight?: number }) {
  const box = useCollapsibleBox({ collapsedHeight });
  return (
    <div className="flex w-96 flex-col gap-2">
      <div className="flex items-center justify-between">
        <Txt variant="caption" tone="muted">
          Content
        </Txt>
        {(box.isClipped || box.isExpanded) && (
          <Button
            variant="ghost"
            size="sm"
            icon={box.isExpanded ? <Minimize2 /> : <Maximize2 />}
            onClick={box.toggleExpanded}
          >
            {box.isExpanded ? 'Collapse' : 'Expand'}
          </Button>
        )}
      </div>
      <CollapsibleBox state={box} className="rounded-lg bg-card p-3">
        {Array.from({ length: paragraphs }, (_, index) => (
          <Txt key={index} as="p" variant="body" className="mb-2">
            Paragraph {index + 1}. The box measures its rendered content and clips it with a fade once it is taller than
            the collapsed height. The expand control is yours to place.
          </Txt>
        ))}
      </CollapsibleBox>
    </div>
  );
}

const meta: Meta<typeof Demo> = {
  title: 'Elements/CollapsibleBox',
  component: Demo,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof Demo>;

export const Overflowing: Story = { args: { paragraphs: 8 } };
export const Fits: Story = { args: { paragraphs: 1 } };
export const CustomHeight: Story = { args: { paragraphs: 8, collapsedHeight: 100 } };
