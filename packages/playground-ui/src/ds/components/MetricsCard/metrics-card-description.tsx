import { cn } from '@/lib/utils';

export function MetricsCardDescription({ children, className }: { children: string; className?: string }) {
  return <p className={cn('mt-0.5 text-ui-md leading-tight text-neutral2', className)}>{children}</p>;
}
