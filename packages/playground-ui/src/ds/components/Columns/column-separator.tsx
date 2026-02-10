import { cn } from '@/lib/utils';

export function ColumnSeparator({ className }: { className?: string }) {
  return <div className={cn('bg-surface4 w-[3px] shrink-0', className)}></div>;
}
