import type { ReactNode } from 'react';
import { Card } from '@/ds/components/Card';
import { cn } from '@/lib/utils';

export function MetricsKpiCardRoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className={cn('min-w-72 flex-1 px-4 py-3', className)}>
      <div className="grid gap-1">{children}</div>
    </Card>
  );
}
