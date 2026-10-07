import type { TokenTimelinePoint } from '@mastra/react/hooks/metrics';
import { useState } from 'react';
import { MetricsCard } from '../../../../ds/components/MetricsCard';
import { MetricsLineChart, MetricsLineChartLegend } from '../../../../ds/components/MetricsLineChart';
import { Tab, TabContent, TabList, Tabs } from '../../../../ds/components/Tabs';
import { CHART_COLORS } from '../metrics-utils';
import { formatCompactNumber, formatCost } from '@/lib/cost';

type TokenUsageTimelineTab = 'tokens' | 'cost';

function sumMetric(dataKey: 'input' | 'output' | 'cost', formatter: (value: number) => string = formatCompactNumber) {
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
    color: CHART_COLORS.amber,
    aggregate: sumMetric('output'),
  },
];

function isTokenUsageTimelineTab(value: string): value is TokenUsageTimelineTab {
  return value === 'tokens' || value === 'cost';
}

export interface TokenUsageTimelineCardContentProps {
  points: TokenTimelinePoint[];
}

/** Tab state only drives the body (chart + legend), so it lives here rather than in the domain card. */
export function TokenUsageTimelineCardContent({ points }: TokenUsageTimelineCardContentProps) {
  const [activeTab, setActiveTab] = useState<TokenUsageTimelineTab>('tokens');

  if (points.length === 0) return <MetricsCard.NoData message="No token usage data yet" />;

  const chartPoints = points.map(point => ({ ...point }));
  const costPoints = points.filter(point => point.cost != null && point.cost > 0);
  const costChartPoints = costPoints.map(point => ({ ...point }));
  const uniqueCostUnits = new Set(costPoints.map(point => point.costUnit).filter((unit): unit is string => !!unit));
  const hasSingleCostUnit = uniqueCostUnits.size === 1 && costPoints.every(point => point.costUnit != null);
  const costUnit = hasSingleCostUnit ? [...uniqueCostUnits][0] : undefined;
  const totalCost = hasSingleCostUnit ? costPoints.reduce((sum, point) => sum + (point.cost ?? 0), 0) : 0;
  const hasCostData = hasSingleCostUnit && totalCost > 0;

  const costSeries = [
    {
      dataKey: 'cost',
      label: 'Cost',
      color: CHART_COLORS.purple,
      aggregate: sumMetric('cost', value => formatCost(value, costUnit)),
    },
  ];

  return (
    <Tabs
      defaultTab="tokens"
      value={activeTab}
      onValueChange={value => {
        if (isTokenUsageTimelineTab(value)) setActiveTab(value);
      }}
      className="overflow-visible"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 [&>:first-child]:w-auto">
        <TabList>
          <Tab value="tokens">Tokens</Tab>
          <Tab value="cost">Cost</Tab>
        </TabList>
        {activeTab === 'tokens' && <MetricsLineChartLegend data={chartPoints} series={tokenSeries} />}
        {activeTab === 'cost' && hasCostData && <MetricsLineChartLegend data={costChartPoints} series={costSeries} />}
      </div>
      <TabContent value="tokens" className="pt-3">
        <MetricsLineChart data={chartPoints} series={tokenSeries} showLegend={false} />
      </TabContent>
      <TabContent value="cost" className="pt-3">
        {hasCostData ? (
          <MetricsLineChart data={costChartPoints} series={costSeries} showLegend={false} />
        ) : (
          <MetricsCard.NoData message="No cost data yet" />
        )}
      </TabContent>
    </Tabs>
  );
}
