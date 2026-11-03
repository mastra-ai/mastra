import { GripVertical } from 'lucide-react';
import type { WidgetDragHandleProps } from './widget-layout';
import { Button } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

/** The grip a widget is dragged by on the layout, given the props `renderWidget` hands it. */
export function WidgetDragHandle({ className, ...props }: WidgetDragHandleProps & { className?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn('shrink-0 cursor-grab active:cursor-grabbing', className)}
      {...props}
    >
      <GripVertical />
    </Button>
  );
}
