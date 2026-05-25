import { cn } from '@/lib/utils';

export function MetricsKpiCardValue({ children, className }: { children: string; className?: string }) {
  return <strong className={cn('text-header-lg text-neutral4 font-semibold', className)}>{children}</strong>;
}
