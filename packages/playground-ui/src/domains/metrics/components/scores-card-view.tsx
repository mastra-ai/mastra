import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { DataList } from '../../../ds/components/DataList/data-list';
import { MetricsCard } from '../../../ds/components/MetricsCard/metrics-card';
import { MetricsLineChart } from '../../../ds/components/MetricsLineChart/metrics-line-chart';
import { TabContent } from '../../../ds/components/Tabs/tabs-content';
import { TabList } from '../../../ds/components/Tabs/tabs-list';
import { Tabs } from '../../../ds/components/Tabs/tabs-root';
import { Tab } from '../../../ds/components/Tabs/tabs-tab';
import type { ScorerSummary, ScoresOverTimePoint } from '../hooks/use-scores-metrics';
import { CHART_COLORS, METRICS_DATA_LIST_PROPS } from './metrics-utils';

const SERIES_COLORS = [
  CHART_COLORS.green,
  CHART_COLORS.blue,
  CHART_COLORS.purple,
  CHART_COLORS.orange,
  CHART_COLORS.pink,
  CHART_COLORS.yellow,
];

export interface ScoresCardViewProps {
  data:
    | {
        summaryData: ScorerSummary[];
        overTimeData: ScoresOverTimePoint[];
        scorerNames: string[];
        avgScore: number | null;
      }
    | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function ScoresCardView({ data, isLoading, isError }: ScoresCardViewProps) {
  const hasData = !!data && (data.summaryData.length > 0 || data.overTimeData.length > 0);

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

  let cardBody: ReactNode;

  if (isLoading) {
    cardBody = <MetricsCard.Loading />;
  } else if (isError) {
    cardBody = <MetricsCard.Error message="Failed to load scores data" />;
  } else if (!data || !hasData) {
    cardBody = (
      <MetricsCard.Content>
        <MetricsCard.NoData message="No scores data yet" />
      </MetricsCard.Content>
    );
  } else {
    cardBody = (
      <MetricsCard.Content>
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
            <DataList columns="auto auto auto auto auto" {...METRICS_DATA_LIST_PROPS}>
              <DataList.Top>
                <DataList.TopCell sticky="start">Scorer</DataList.TopCell>
                <DataList.TopCell className="justify-end text-right">Avg</DataList.TopCell>
                <DataList.TopCell className="justify-end text-right">Min</DataList.TopCell>
                <DataList.TopCell className="justify-end text-right">Max</DataList.TopCell>
                <DataList.TopCell className="justify-end text-right">Count</DataList.TopCell>
              </DataList.Top>
              {data.summaryData.map(row => (
                <DataList.RowStatic key={row.scorer}>
                  <DataList.RowHeaderCell height="compact" className="text-ui-sm">
                    {row.scorer}
                  </DataList.RowHeaderCell>
                  <DataList.NumberCell highlight>{row.avg.toFixed(2)}</DataList.NumberCell>
                  <DataList.NumberCell>{row.min.toFixed(2)}</DataList.NumberCell>
                  <DataList.NumberCell>{row.max.toFixed(2)}</DataList.NumberCell>
                  <DataList.NumberCell>{row.count.toLocaleString()}</DataList.NumberCell>
                </DataList.RowStatic>
              ))}
            </DataList>
          </TabContent>
        </Tabs>
      </MetricsCard.Content>
    );
  }

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Scores" description="Evaluation scorer performance." />
      </MetricsCard.TopBar>
      {cardBody}
    </MetricsCard>
  );
}
