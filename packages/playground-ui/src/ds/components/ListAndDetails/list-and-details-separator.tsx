import { cn } from '@/lib/utils';

export function ListAndDetailsSeparator({ className }: { className?: string }): React.JSX.Element {
  return <div className={cn('bg-surface4 w-[3px] shrink-0', className)}></div>;
}
