import { cn } from '@/lib/utils';

export function MetricsCardDescription({ children, className }: { children: string; className?: string }) {
  return <p className={cn('text-ui-md text-neutral2 leading-tight mt-0.5', className)}>{children}</p>;
}
