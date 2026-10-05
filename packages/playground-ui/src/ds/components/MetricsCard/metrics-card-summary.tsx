import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

/** Always the top bar's last item, so action buttons sit to its left and the value hugs the edge. */
export function MetricsCardSummary({ value, label, className }: { value: string; label?: string; className?: string }) {
  return (
    <div className={cn('order-last text-right', className)}>
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
