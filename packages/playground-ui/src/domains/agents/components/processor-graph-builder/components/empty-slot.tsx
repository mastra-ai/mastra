import { cn } from '@/lib/utils';

interface EmptySlotProps {
  isDraggingOver: boolean;
}

export function EmptySlot({ isDraggingOver }: EmptySlotProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded border border-dashed p-4 text-ui-sm text-neutral3 transition-colors',
        isDraggingOver ? 'border-accent1/50 bg-accent1/5 text-accent1' : 'border-border2',
      )}
    >
      {isDraggingOver ? 'Drop processor here' : 'Drag a processor here'}
    </div>
  );
}
