import type { ListScoresResponse } from '@mastra/core/evals';
import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { MetricsLineChart } from '@mastra/playground-ui/components/MetricsLineChart';
import { useMemo } from 'react';
import { buildScoreChartData } from './trace-score-line-chart.utils';

const SERIES_COLORS = ['#22c55e', '#4f83f1', '#8b5cf6', '#fb923c', '#f472b6', '#facc15'];

export function TraceScoreLineChart({
  scoresData,
  className,
}: {
  scoresData?: ListScoresResponse | null;
  className?: string;
}) {
  const { data, scorerNames } = useMemo(() => buildScoreChartData(scoresData?.scores ?? []), [scoresData?.scores]);

  const series = useMemo(
    () =>
      scorerNames.map((name, i) => ({
        dataKey: name,
        label: name,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
        aggregate: (points: Record<string, unknown>[]) => {
          const values = points.map(point => point[name]).filter((value): value is number => typeof value === 'number');
          return {
            value: values.length > 0 ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2) : '0',
            suffix: 'avg',
          };
        },
      })),
    [scorerNames],
  );

  if (data.length === 0) return null;

  return (
    <Card appearance="surface" className={className}>
      <CardContent>
        <MetricsLineChart
          data={data}
          series={series}
          height={90}
          yDomain={[0, 1]}
          xAxisInterval="preserveStartEnd"
          xAxisMinTickGap={40}
          showDots
        />
      </CardContent>
    </Card>
  );
}
