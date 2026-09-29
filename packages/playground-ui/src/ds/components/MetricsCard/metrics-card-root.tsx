import type { ReactNode } from 'react';
import { Card } from '@/ds/components/Card';
import { cn } from '@/lib/utils';

export function MetricsCardRoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card
      className={cn(
        'grid min-h-72 min-w-80 flex-1 grid-rows-[auto_1fr] gap-4 px-4 py-3 2xl:min-w-120 md:min-w-88 lg:min-w-sm xl:min-w-104',
        className,
      )}
    >
      {children}
    </Card>
  );
}
