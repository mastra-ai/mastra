import { useState } from 'react';
import { HorizontalBars } from '../../../ds/components/HorizontalBars';
import { MetricsCard } from '../../../ds/components/MetricsCard';
import { Tab, TabContent, TabList, Tabs } from '../../../ds/components/Tabs';
import type { TokenUsageByAgentRow } from '../hooks/use-token-usage-by-agent-metrics';
import { CHART_COLORS, formatCompact, formatCost } from './metrics-utils';

export interface TokenUsageByAgentCardViewProps {
  data: TokenUsageByAgentRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

type TokenUsageTab = 'tokens' | 'cost';

function isTokenUsageTab(value: string): value is TokenUsageTab {
  return value === 'tokens' || value === 'cost';
}

export function TokenUsageByAgentCardView({ data, isLoading, isError }: TokenUsageByAgentCardViewProps) {
  const [activeTab, setActiveTab] = useState<TokenUsageTab>('tokens');

  const rows = data ?? [];
  const hasData = rows.length > 0;
  const totalTokens = rows.reduce((s, d) => s + d.total, 0);
  const costRows = rows.filter(d => d.cost != null && d.cost > 0);
  const uniqueCostUnits = new Set(costRows.map(d => d.costUnit ?? 'usd'));
  const hasSingleCostUnit = uniqueCostUnits.size <= 1;
  const costUnit = hasSingleCostUnit ? ([...uniqueCostUnits][0] ?? 'usd') : null;
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
              onValueChange={v => {
                if (isTokenUsageTab(v)) setActiveTab(v);
              }}
              className="grid grid-rows-[auto_1fr] overflow-y-auto h-full"
            >
              <TabList>
                <Tab value="tokens">Tokens</Tab>
                <Tab value="cost">Cost</Tab>
              </TabList>
              <TabContent value="tokens">
                <HorizontalBars
                  data={rows.map(d => ({ name: d.name, values: [d.input, d.output] }))}
                  segments={[
                    { label: 'Input', color: CHART_COLORS.blueDark },
                    { label: 'Output', color: CHART_COLORS.blue },
                  ]}
                  maxVal={Math.max(...rows.map(d => d.input + d.output))}
                  fmt={formatCompact}
                />
              </TabContent>
              <TabContent value="cost">
                {hasCostData ? (
                  <HorizontalBars
                    data={costRows
                      .slice()
                      .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
                      .map(d => ({ name: d.name, values: [d.cost!] }))}
                    segments={[{ label: 'Cost', color: CHART_COLORS.purple }]}
                    maxVal={Math.max(...costRows.map(d => d.cost ?? 0))}
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
