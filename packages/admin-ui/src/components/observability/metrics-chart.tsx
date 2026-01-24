import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AggregatedMetrics, MetricDataPoint } from '@/types/api';
import { cn } from '@/lib/utils';

interface MetricsChartProps {
  metrics: AggregatedMetrics;
  className?: string;
}

export function MetricsChart({ metrics, className }: MetricsChartProps) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
      <MetricCard title="Total Requests" value={metrics.totalRequests.toLocaleString()} />
      <MetricCard
        title="Success Rate"
        value={`${(metrics.successRate * 100).toFixed(1)}%`}
        trend={metrics.successRate >= 0.99 ? 'positive' : metrics.successRate >= 0.95 ? 'neutral' : 'negative'}
      />
      <MetricCard title="Avg Latency" value={`${Math.round(metrics.avgLatencyMs)}ms`} />
      <MetricCard
        title="Errors"
        value={metrics.errorCount.toLocaleString()}
        trend={metrics.errorCount === 0 ? 'positive' : 'negative'}
      />
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  trend?: 'positive' | 'neutral' | 'negative';
}

function MetricCard({ title, value, trend }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-neutral6">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'text-2xl font-bold',
            trend === 'positive' && 'text-green-500',
            trend === 'negative' && 'text-red-500',
            !trend && 'text-neutral9',
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

interface LatencyChartProps {
  metrics: AggregatedMetrics;
  className?: string;
}

export function LatencyChart({ metrics, className }: LatencyChartProps) {
  const latencyPercentiles = [
    { label: 'p50', value: metrics.p50LatencyMs },
    { label: 'p95', value: metrics.p95LatencyMs },
    { label: 'p99', value: metrics.p99LatencyMs },
  ];

  const maxLatency = Math.max(...latencyPercentiles.map(p => p.value));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Latency Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {latencyPercentiles.map(percentile => (
            <div key={percentile.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral6 uppercase">{percentile.label}</span>
                <span className="font-mono">{Math.round(percentile.value)}ms</span>
              </div>
              <div className="h-2 bg-surface4 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent1 rounded-full transition-all"
                  style={{ width: `${(percentile.value / maxLatency) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface TimeSeriesChartProps {
  data: MetricDataPoint[];
  title: string;
  unit?: string;
  className?: string;
}

export function TimeSeriesChart({ data, title, unit = '', className }: TimeSeriesChartProps) {
  const { normalizedData, maxValue, minValue } = useMemo(() => {
    if (data.length === 0) return { normalizedData: [], maxValue: 0, minValue: 0 };
    const values = data.map(d => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    return {
      normalizedData: data.map(d => ({
        ...d,
        normalized: ((d.value - min) / range) * 100,
      })),
      maxValue: max,
      minValue: min,
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-neutral6">No data available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] flex items-end gap-1">
          {normalizedData.map((point, index) => (
            <div
              key={index}
              className="flex-1 bg-accent1 rounded-t transition-all hover:bg-accent2"
              style={{ height: `${Math.max(point.normalized, 5)}%` }}
              title={`${point.value}${unit}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-neutral6">
          <span>
            {minValue.toFixed(0)}
            {unit}
          </span>
          <span>
            {maxValue.toFixed(0)}
            {unit}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
