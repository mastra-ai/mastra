import { useMemo } from 'react';
import type { HistogramBucket } from '../lib/histogram-buckets';
import { BUCKET_AXIS } from '@/domains/metrics/lib/chart-axis';
import { CHART_COLORS } from '@/domains/metrics/lib/chart-colors';
import { formatCount } from '@/domains/metrics/lib/chart-format';
import { MetricsStackedBarChart } from '@/ds/components/MetricsStackedBarChart';
import { Txt } from '@/ds/components/Txt';
import type { DragSelectionRange } from '@/ds/primitives/charts/drag-selection';
import { cn } from '@/lib/utils';

const CHART_HEIGHT = 64;
const VOLUME_COLOR = 'var(--fill-strong)';
const MAX_BAR_SIZE = 40;
const ERRORS_SERIES = { dataKey: 'errors', label: 'Errors', color: CHART_COLORS.error };

export type ObservabilityHistogramProps = {
  label: string;
  resourceLabel: string;
  buckets: HistogramBucket[];
  isLoading?: boolean;
  isError?: boolean;
  isUpdating?: boolean;
  onZoom?: (range: DragSelectionRange) => void;
};

export function ObservabilityHistogram({
  label,
  resourceLabel,
  buckets,
  isLoading = false,
  isError = false,
  isUpdating = false,
  onZoom,
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
          {formatCount(ok + errors)} {resourceLabel.toLowerCase()}, {formatCount(errors)} errors
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
            onZoom={onZoom}
            onBucketClick={onZoom ? (_row, index) => onZoom({ start: index, end: index }) : undefined}
            {...BUCKET_AXIS}
          />
        </div>
      )}
    </section>
  );
}
