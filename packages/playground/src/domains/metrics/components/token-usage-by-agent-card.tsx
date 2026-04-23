import { HorizontalBars, MetricsCard, Tabs, TabList, Tab, TabContent } from '@mastra/playground-ui';
import { useState } from 'react';
import { useTokenUsageByAgentMetrics } from '../hooks/use-token-usage-by-agent-metrics';
import { CHART_COLORS, formatCompact, formatCost } from './metrics-utils';

export function TokenUsageByAgentCard() {
  const { data, isLoading, isError } = useTokenUsageByAgentMetrics();
  const [activeTab, setActiveTab] = useState<'tokens' | 'cost'>('tokens');

  const hasData = !!data && data.length > 0;
  const totalTokens = data?.reduce((s, d) => s + d.total, 0) ?? 0;
  const costRows = data?.filter(d => d.cost != null && d.cost > 0) ?? [];
  const uniqueCostUnits = new Set(costRows.map(d => d.costUnit ?? 'usd'));
  const hasSingleCostUnit = uniqueCostUnits.size <= 1;
  const costUnit = hasSingleCostUnit ? (costRows[0]?.costUnit ?? null) : null;
  const totalCost = hasSingleCostUnit ? costRows.reduce((s, d) => s + (d.cost ?? 0), 0) : 0;
  const hasCostData = hasSingleCostUnit && totalCost > 0;

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription
          title="Token Usage by Agent"
          description="Token consumption grouped by agent."
        />
        {hasData &&
          (activeTab === 'cost' && hasCostData ? (
            <MetricsCard.Summary value={formatCost(totalCost, costUnit)} label="Total cost" />
          ) : (
            <MetricsCard.Summary value={formatCompact(totalTokens)} label="Total tokens" />
          ))}
      </MetricsCard.TopBar>
      {isLoading ? (
        <MetricsCard.Loading />
      ) : isError ? (
        <MetricsCard.Error message="Failed to load token usage data" />
      ) : (
        <MetricsCard.Content>
          {!hasData ? (
            <MetricsCard.NoData message="No token usage data yet" />
          ) : (
            <Tabs
              defaultTab="tokens"
              value={activeTab}
              onValueChange={v => setActiveTab(v as 'tokens' | 'cost')}
              className="grid grid-rows-[auto_1fr] overflow-y-auto h-full"
            >
              <TabList>
                <Tab value="tokens">Tokens</Tab>
                <Tab value="cost">Cost</Tab>
              </TabList>
              <TabContent value="tokens">
                <HorizontalBars
                  data={data.map(d => ({ name: d.name, values: [d.input, d.output] }))}
                  segments={[
                    { label: 'Input', color: CHART_COLORS.blueDark },
                    { label: 'Output', color: CHART_COLORS.blue },
                  ]}
                  maxVal={Math.max(...data.map(d => d.input + d.output))}
                  fmt={formatCompact}
                />
              </TabContent>
              <TabContent value="cost">
                {hasCostData ? (
                  <HorizontalBars
                    data={data
                      .filter(d => d.cost != null && d.cost > 0)
                      .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
                      .map(d => ({ name: d.name, values: [d.cost!] }))}
                    segments={[{ label: 'Cost', color: CHART_COLORS.purple }]}
                    maxVal={Math.max(...data.map(d => d.cost ?? 0))}
                    fmt={v => formatCost(v, costUnit)}
                  />
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
