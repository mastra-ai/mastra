import { MetricsCard, MetricsDataTable, MetricsLineChart, Tabs, TabList, Tab, TabContent } from '@mastra/playground-ui';
import { useMemo } from 'react';

import { useScoresMetrics } from '../hooks/use-scores-metrics';
import { CHART_COLORS } from './metrics-utils';

const SERIES_COLORS = [
  CHART_COLORS.green,
  CHART_COLORS.blue,
  CHART_COLORS.purple,
  CHART_COLORS.orange,
  CHART_COLORS.pink,
  CHART_COLORS.yellow,
];

export function ScoresCard() {
  const { data, isLoading, isError } = useScoresMetrics();
  const hasData = !!data && data.summaryData.length > 0;

  const series = useMemo(() => {
    if (!data?.scorerNames) return [];
    return data.scorerNames.map((name, i) => ({
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
  }, [data?.scorerNames]);

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Scores" description="Evaluation scorer performance." />
        {hasData && (
          <MetricsCard.Summary
            value={data?.avgScore != null ? `avg ${data.avgScore}` : '—'}
            label="Across all scorers"
          />
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
              <TabContent value="over-time" className="pb-0">
                {data.overTimeData.length > 0 ? (
                  <MetricsLineChart data={data.overTimeData} series={series} yDomain={[0, 1]} />
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
                  data={data.summaryData.map(row => ({ ...row, key: row.scorer }))}
                />
              </TabContent>
            </Tabs>
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
