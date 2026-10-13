import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export function MetricsCardDescription({ children, className }: { children: string; className?: string }) {
  return (
    <Txt tone="faint" className={cn('mt-0.5', className)}>
      {children}
    </Txt>
  );
}
