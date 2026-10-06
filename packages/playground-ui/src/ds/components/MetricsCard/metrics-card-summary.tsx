import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export function MetricsCardSummary({ value, label, className }: { value: string; label?: string; className?: string }) {
  return (
    <div className={cn('text-right', className)}>
      <Txt tone="muted" className="tabular-nums">
        {value}
      </Txt>
      {label && (
        <Txt tone="faint" className="mt-0.5">
          {label}
        </Txt>
      )}
    </div>
  );
}
