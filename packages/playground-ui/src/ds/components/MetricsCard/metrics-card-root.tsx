import type { ReactNode } from 'react';
import { Card } from '@/ds/components/Card';
import { cn } from '@/lib/utils';

export function MetricsCardRoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card
      className={cn(
        '2xl:min-w-120 md:min-w-88 xl:min-w-104 grid min-h-72 min-w-80 flex-1 grid-rows-[4rem_1fr] gap-2 px-4 py-3 lg:min-w-sm',
        className,
      )}
    >
      {children}
    </Card>
  );
}
