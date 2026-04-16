import { MetricsCard, MetricsDataTable, MetricsLineChart, Tabs, TabList, Tab, TabContent } from '@mastra/playground-ui';
import { useMemo } from 'react';
import type { ScorerSummary, ScoresOverTimePoint } from '../hooks/use-score-metrics';

const SERIES_COLORS = ['#22c55e', '#4f83f1', '#8b5cf6', '#fb923c', '#f472b6', '#facc15'];

interface ScoresOverTimeCardProps {
  summaryData: ScorerSummary[];
  overTimeData: ScoresOverTimePoint[];
  scorerNames: string[];
  avgScore: number | null;
  isLoading: boolean;
  isError: boolean;
}

export function ScoresOverTimeCard({
  summaryData,
  overTimeData,
  scorerNames,
  avgScore,
  isLoading,
  isError,
}: ScoresOverTimeCardProps) {
  const hasData = summaryData.length > 0;

  const series = useMemo(() => {
    return scorerNames.map((name, i) => ({
      dataKey: name,
      label: name,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      aggregate: (points: Record<string, unknown>[]) => ({
        value:
          points.length > 0
            ? (points.reduce((s, d) => s + ((d[name] as number) ?? 0), 0) / points.length).toFixed(2)
            : '0',
        suffix: 'avg',
      }),
    }));
  }, [scorerNames]);

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription
          title="Scores"
          description="Evaluation scorer performance across all scorers."
        />
        {hasData && (
          <MetricsCard.Summary value={avgScore != null ? `avg ${avgScore}` : '—'} label="Across all scorers" />
        )}
      </MetricsCard.TopBar>
      {isLoading ? (
        <MetricsCard.Loading />
      ) : isError ? (
        <MetricsCard.Error message="Failed to load scores data" />
      ) : (
        <MetricsCard.Content>
          {!hasData ? (
            <MetricsCard.NoData message="No scores data yet" />
          ) : (
            <Tabs defaultTab="over-time" className="overflow-visible">
              <TabList>
                <Tab value="over-time">Over Time</Tab>
                <Tab value="summary">Summary</Tab>
              </TabList>
              <TabContent value="over-time">
                {overTimeData.length > 0 ? (
                  <MetricsLineChart data={overTimeData} series={series} yDomain={[0, 1]} />
                ) : (
                  <MetricsCard.NoData message="No time series data yet" />
                )}
              </TabContent>
              <TabContent value="summary">
                <MetricsDataTable
                  columns={[
                    { label: 'Scorer', value: row => row.scorer },
                    { label: 'Avg', value: row => row.avg.toFixed(2), highlight: true },
                    { label: 'Min', value: row => row.min.toFixed(2) },
                    { label: 'Max', value: row => row.max.toFixed(2) },
                    { label: 'Count', value: row => row.count.toLocaleString() },
                  ]}
                  data={summaryData.map(row => ({ ...row, key: row.scorer }))}
                />
              </TabContent>
            </Tabs>
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
