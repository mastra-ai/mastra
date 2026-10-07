import type { MetricsLineChartSeries } from './metrics-line-chart';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export function MetricsLineChartLegend({
  data,
  series,
  className,
}: {
  /** Rows for each series' `aggregate`; omit when no series shows one. */
  data?: Record<string, unknown>[];
  series: MetricsLineChartSeries[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1', className)}>
      {series.map(s => {
        const aggregated = data ? s.aggregate?.(data) : undefined;
        return (
          <div key={s.dataKey} className="inline-flex items-center gap-1.5">
            {s.dashed ? (
              <span className="h-0 w-3 shrink-0 border-t-2 border-dashed" style={{ borderColor: s.color }} />
            ) : (
              <div className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: s.color }} />
            )}
            <Txt as="span" variant="body-sm" tone="muted" className="max-w-48 truncate">
              {s.label}
            </Txt>
            {aggregated && (
              <Txt as="span" variant="body-sm" tone="muted" className="-ml-1 tabular-nums">
                {aggregated.value}
                {aggregated.suffix && (
                  <Txt as="span" variant="body-sm" tone="faint">
                    {' '}
                    {aggregated.suffix}
                  </Txt>
                )}
              </Txt>
            )}
          </div>
        );
      })}
    </div>
  );
}
