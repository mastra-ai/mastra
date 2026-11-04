import type { MetricsLineChartSeries } from './metrics-line-chart';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

/** A marker and a label per series. Totals belong in the card's header, not here. */
export function MetricsLineChartLegend({
  series,
  className,
}: {
  series: Pick<MetricsLineChartSeries, 'dataKey' | 'label' | 'color' | 'dashed'>[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1', className)}>
      {series.map(s => (
        <div key={s.dataKey} className="inline-flex items-center gap-1.5">
          {s.dashed ? (
            <span className="h-0 w-3 shrink-0 border-t-2 border-dashed" style={{ borderColor: s.color }} />
          ) : (
            <div className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: s.color }} />
          )}
          <Txt as="span" variant="body-sm" tone="muted" className="max-w-48 truncate">
            {s.label}
          </Txt>
        </div>
      ))}
    </div>
  );
}
