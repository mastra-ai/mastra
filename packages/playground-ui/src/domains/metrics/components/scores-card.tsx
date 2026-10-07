import { useMetricsScores } from '../hooks/use-metrics-scores';
import type { ScorerAverage } from '../hooks/use-metrics-scores';
import { BUCKET_AXIS } from '../lib/chart-axis';
import { CHART_COLORS } from '../lib/chart-colors';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { ChartCardError } from './chart-card-error';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type { MetricsLineChartSeries } from '@/ds/components/MetricsLineChart';
import { MetricsLineChart } from '@/ds/components/MetricsLineChart';

/** Scores aren't problems, so no warm hues; past five scorers the colors repeat. */
const SCORER_COLORS = [
  CHART_COLORS.green,
  CHART_COLORS.sky,
  CHART_COLORS.violet,
  CHART_COLORS.teal,
  CHART_COLORS.indigo,
];

const formatScore = (score: number) => score.toFixed(2);
const axisScore = (score: number) => score.toFixed(1);

/** One line per scorer; the legend carries its mean over the range. */
function scorerSeries(scorers: ScorerAverage[]): MetricsLineChartSeries[] {
  return scorers.map(({ scorerId, name, average }, i) => ({
    dataKey: scorerId,
    label: name,
    color: SCORER_COLORS[i % SCORER_COLORS.length] ?? CHART_COLORS.neutral,
    aggregate: () => ({ value: formatScore(average) }),
  }));
}

/** Average result of each scorer over time, 0 to 1. */
export function ScoresCard() {
  const { data, isLoading, isError, isPlaceholderData } = useMetricsScores();
  const scorers = data?.scorers ?? [];

  const layout = { title: 'Scores', description: 'Average scorer result, 0 to 1.' };

  if (isError) {
    return (
      <ChartCard {...layout}>
        <ChartCardError />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      {...layout}
      summary={
        <MetricsCard.Summary
          value={String(scorers.length)}
          label={scorers.length === 1 ? 'scorer' : 'scorers'}
          isLoading={isLoading}
        />
      }
      isUpdating={isPlaceholderData}
    >
      <ChartArea isEmpty={!isLoading && scorers.length === 0} emptyMessage="No scores in this range.">
        <MetricsLineChart
          data={data?.buckets ?? []}
          series={scorerSeries(scorers)}
          height="fill"
          showYAxis={false}
          yDomain={[0, 1]}
          valueFormatter={formatScore}
          axisFormatter={axisScore}
          isLoading={isLoading}
          {...BUCKET_AXIS}
        />
      </ChartArea>
    </ChartCard>
  );
}
