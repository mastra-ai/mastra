import type { DragEventHandler } from 'react';
import { Button } from '@/ds/components/Button';
import { IconDotGrid2x3 } from '@/ds/icons/central/IconDotGrid2x3';
import { cn } from '@/lib/utils';

/** What a host's layout hands a card so it can be dragged, e.g. to rearrange a dashboard. */
export type MetricsCardDragHandleProps = {
  /** What dragging does, e.g. "Move widget". */
  'aria-label': string;
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLElement>;
  onDragEnd?: DragEventHandler<HTMLElement>;
  className?: string;
};

/** The grip a card is dragged by, left of its title. Its negative margin keeps the top bar's height. */
export function MetricsCardDragHandle({ className, ...props }: MetricsCardDragHandleProps) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn('-my-1 shrink-0 cursor-grab active:cursor-grabbing', className)}
      {...props}
    >
      <IconDotGrid2x3 />
    </Button>
  );
}
