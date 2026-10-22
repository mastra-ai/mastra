import type { ReactNode } from 'react';
import { Skeleton } from '@/ds/components/Skeleton';
import { cn } from '@/lib/utils';

export function MetricsKpiCardValueRow({
  children,
  isLoading = false,
  className,
}: {
  children?: ReactNode;
  /** A value-sized skeleton in place of the value and its change badge. */
  isLoading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-6 items-center gap-2 whitespace-nowrap *:shrink-0', className)}>
      {isLoading ? <Skeleton className="h-6 w-20" /> : children}
    </div>
  );
}
