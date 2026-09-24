import type { MetricsLineChartSeries } from './metrics-line-chart';
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
            <div className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="max-w-24 truncate text-caption text-muted-foreground">{s.label}</span>
            {aggregated && (
              <span className="text-caption text-muted-foreground">
                {aggregated.value}
                {aggregated.suffix && <span className="text-caption text-placeholder"> {aggregated.suffix}</span>}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
