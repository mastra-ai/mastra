import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export function MetricsKpiCardLabel({ children, className }: { children: string; className?: string }) {
  return (
    <Txt as="span" tone="ink" className={cn('font-medium', className)}>
      {children}
    </Txt>
  );
}
