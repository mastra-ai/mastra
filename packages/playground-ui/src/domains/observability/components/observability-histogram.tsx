import { useMemo } from 'react';
import type { HistogramBucket } from '../lib/histogram-buckets';
import { BUCKET_AXIS } from '@/domains/metrics/lib/chart-axis';
import { CHART_COLORS } from '@/domains/metrics/lib/chart-colors';
import { formatCount } from '@/domains/metrics/lib/chart-format';
import { MetricsStackedBarChart } from '@/ds/components/MetricsStackedBarChart';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

/** A thin strip: about 34px of bars above the time axis, so the list keeps its vertical space. */
const CHART_HEIGHT = 64;
/** A neutral surface tint, so the volume stays in the background and only errors carry color. */
const VOLUME_COLOR = 'var(--fill-strong)';
/** Up to 90 bars share the width; the cap only matters for short custom windows with few bars. */
const MAX_BAR_SIZE = 40;
const ERRORS_SERIES = { dataKey: 'errors', label: 'Errors', color: CHART_COLORS.error };

export type ObservabilityHistogramProps = {
  /** Accessible name of the chart region, e.g. "Traces over time". */
  label: string;
  /** Series and total label for non-error rows, e.g. "Traces". */
  resourceLabel: string;
  buckets: HistogramBucket[];
  isLoading?: boolean;
  isError?: boolean;
  /** Previous buckets stay on screen, dimmed, while a new selection loads. */
  isUpdating?: boolean;
};

/**
 * A compact, full-width stacked bar strip of non-error and error counts over the list's time
 * range. Per-bucket values live in the tooltip; the totals are announced to assistive tech only.
 */
export function ObservabilityHistogram({
  label,
  resourceLabel,
  buckets,
  isLoading = false,
  isError = false,
  isUpdating = false,
}: ObservabilityHistogramProps) {
  const series = useMemo(
    () => [{ dataKey: 'ok', label: resourceLabel, color: VOLUME_COLOR }, ERRORS_SERIES],
    [resourceLabel],
  );
  let ok = 0;
  let errors = 0;
  for (const bucket of buckets) {
    ok += bucket.ok;
    errors += bucket.errors;
  }

  return (
    <section aria-label={label} aria-busy={isLoading || isUpdating} className="shrink-0">
      {!isError && !isLoading && (
        <span className="sr-only">
          {formatCount(ok + errors)} {resourceLabel.toLowerCase()} · {formatCount(errors)} errors
        </span>
      )}
      {isError ? (
        <div className="flex items-center justify-center" style={{ height: CHART_HEIGHT }}>
          <Txt variant="caption" tone="muted">
            Couldn't load the chart.
          </Txt>
        </div>
      ) : (
        <div className={cn('transition-opacity duration-200', isUpdating && 'opacity-50')}>
          <MetricsStackedBarChart
            data={buckets}
            series={series}
            height={CHART_HEIGHT}
            showYAxis={false}
            showLegend={false}
            maxBarSize={MAX_BAR_SIZE}
            valueFormatter={formatCount}
            isLoading={isLoading}
            {...BUCKET_AXIS}
          />
        </div>
      )}
    </section>
  );
}
