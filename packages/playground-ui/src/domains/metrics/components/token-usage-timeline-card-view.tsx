import { useState } from 'react';
import type { ReactNode } from 'react';
import { MetricsCard } from '../../../ds/components/MetricsCard';
import { MetricsLineChart } from '../../../ds/components/MetricsLineChart';
import { Tab, TabContent, TabList, Tabs } from '../../../ds/components/Tabs';
import type { TokenTimelinePoint, TokenUsageTimeSeriesInterval } from '../hooks/use-token-usage-timeseries';
import { CHART_COLORS, formatCompact, formatCost } from './metrics-utils';

type TokenUsageTimelineTab = 'tokens' | 'cost';

function sumMetric(dataKey: 'input' | 'output' | 'cost', formatter: (value: number) => string = formatCompact) {
  return (data: Record<string, unknown>[]) => ({
    value: formatter(data.reduce((sum, point) => sum + (typeof point[dataKey] === 'number' ? point[dataKey] : 0), 0)),
  });
}

const tokenSeries = [
  {
    dataKey: 'input',
    label: 'Input tokens',
    color: CHART_COLORS.blue,
    aggregate: sumMetric('input'),
  },
  {
    dataKey: 'output',
    label: 'Output tokens',
    color: CHART_COLORS.yellow,
    aggregate: sumMetric('output'),
  },
];

function isTokenUsageTimelineTab(value: string): value is TokenUsageTimelineTab {
  return value === 'tokens' || value === 'cost';
}

export interface TokenUsageTimelineCardViewProps {
  data: TokenTimelinePoint[] | undefined;
  interval: TokenUsageTimeSeriesInterval | undefined;
  isLoading: boolean;
  isError: boolean;
  actions?: ReactNode;
}

export function TokenUsageTimelineCardView({
  data,
  interval = '1d',
  isLoading,
  isError,
  actions,
}: TokenUsageTimelineCardViewProps) {
  const [activeTab, setActiveTab] = useState<TokenUsageTimelineTab>('tokens');

  const points = data ?? [];
  const chartPoints = points.map(point => ({ ...point }));
  const hasData = points.length > 0;
  const totalTokens = points.reduce((sum, point) => sum + point.total, 0);
  const costPoints = points.filter(point => point.cost != null && point.cost > 0);
  const costChartPoints = costPoints.map(point => ({ ...point }));
  const uniqueCostUnits = new Set(costPoints.map(point => point.costUnit).filter((unit): unit is string => !!unit));
  const hasSingleCostUnit = uniqueCostUnits.size === 1 && costPoints.every(point => point.costUnit != null);
  const costUnit = hasSingleCostUnit ? ([...uniqueCostUnits][0] ?? null) : null;
  const totalCost = hasSingleCostUnit ? costPoints.reduce((sum, point) => sum + (point.cost ?? 0), 0) : 0;
  const hasCostData = hasSingleCostUnit && totalCost > 0;
  const description = interval === '1h' ? 'Input and output tokens per hour.' : 'Input and output tokens per day.';

  const costSeries = [
    {
      dataKey: 'cost',
      label: 'Cost',
      color: CHART_COLORS.purple,
      aggregate: sumMetric('cost', value => formatCost(value, costUnit)),
    },
  ];

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Token usage over time" description={description} />
        {hasData &&
          (activeTab === 'cost' && hasCostData ? (
            <MetricsCard.Summary value={formatCost(totalCost, costUnit)} label="Total cost" />
          ) : (
            <MetricsCard.Summary value={formatCompact(totalTokens)} label="Total tokens" />
          ))}
        {hasData && actions ? <MetricsCard.Actions>{actions}</MetricsCard.Actions> : null}
      </MetricsCard.TopBar>
      {isLoading ? (
        <MetricsCard.Loading />
      ) : isError ? (
        <MetricsCard.Error message="Failed to load token usage timeline" />
      ) : (
        <MetricsCard.Content>
          {!hasData ? (
            <MetricsCard.NoData message="No token usage data yet" />
          ) : (
            <Tabs
              defaultTab="tokens"
              value={activeTab}
              onValueChange={value => {
                if (isTokenUsageTimelineTab(value)) setActiveTab(value);
              }}
              className="overflow-visible"
            >
              <TabList>
                <Tab value="tokens">Tokens</Tab>
                <Tab value="cost">Cost</Tab>
              </TabList>
              <TabContent value="tokens">
                <MetricsLineChart data={chartPoints} series={tokenSeries} />
              </TabContent>
              <TabContent value="cost">
                {hasCostData ? (
                  <MetricsLineChart data={costChartPoints} series={costSeries} />
                ) : (
                  <MetricsCard.NoData message="No cost data yet" />
                )}
              </TabContent>
            </Tabs>
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
