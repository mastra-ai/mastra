import { cn } from '@/lib/utils';

export function MetricsCardTitle({ children, className }: { children: string; className?: string }) {
  return <h3 className={cn('text-ui-md font-normal text-neutral4', className)}>{children}</h3>;
}
