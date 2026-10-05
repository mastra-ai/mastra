import type { MetricsLineChartSeries } from './metrics-line-chart';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export function MetricsLineChartLegend({
  data,
  series,
  className,
}: {
  data: Record<string, unknown>[];
  series: MetricsLineChartSeries[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-4 gap-y-1', className)}>
      {series.map(s => {
        const aggregated = s.aggregate?.(data);
        return (
          <div key={s.dataKey} className="inline-flex items-center gap-2">
            <div className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: s.color }} />
            <Txt as="span" variant="caption" tone="muted" className="max-w-24 truncate">
              {s.label}
            </Txt>
            {aggregated && (
              <Txt as="span" variant="caption" tone="muted">
                {aggregated.value}
                {aggregated.suffix && (
                  <Txt as="span" variant="caption" tone="faint">
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
