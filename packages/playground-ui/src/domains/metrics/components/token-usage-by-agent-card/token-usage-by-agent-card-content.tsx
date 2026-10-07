import type { TokenUsageByAgentRow } from '@mastra/react/hooks/metrics';
import { HorizontalBars } from '../../../../ds/components/HorizontalBars/horizontal-bars';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';
import { TabContent } from '../../../../ds/components/Tabs/tabs-content';
import { TabList } from '../../../../ds/components/Tabs/tabs-list';
import { Tabs } from '../../../../ds/components/Tabs/tabs-root';
import { Tab } from '../../../../ds/components/Tabs/tabs-tab';
import { CHART_COLORS } from '../metrics-utils';
import { isTokenUsageTab } from './token-usage-by-agent-card.utils';
import type { TokenUsageCostSummary, TokenUsageTab } from './token-usage-by-agent-card.utils';
import { formatCompactNumber, formatCost } from '@/lib/cost';

export interface TokenUsageByAgentCardContentProps {
  rows: TokenUsageByAgentRow[];
  cost: TokenUsageCostSummary;
  activeTab: TokenUsageTab;
  onTabChange: (tab: TokenUsageTab) => void;
  onRowClick?: (row: TokenUsageByAgentRow) => void;
}

export function TokenUsageByAgentCardContent({
  rows,
  cost,
  activeTab,
  onTabChange,
  onRowClick,
}: TokenUsageByAgentCardContentProps) {
  if (rows.length === 0) return <MetricsCard.NoData message="No token usage data yet" />;

  return (
    <Tabs
      defaultTab="tokens"
      value={activeTab}
      onValueChange={v => {
        if (isTokenUsageTab(v)) onTabChange(v);
      }}
      className="grid h-full grid-rows-[auto_1fr] overflow-y-auto"
    >
      <TabList>
        <Tab value="tokens">Tokens</Tab>
        <Tab value="cost">Cost</Tab>
      </TabList>
      <TabContent value="tokens" className="pt-3">
        <HorizontalBars
          data={rows.map(d => ({
            name: d.name,
            values: [d.input, d.output],
            onClick: onRowClick ? () => onRowClick(d) : undefined,
          }))}
          segments={[
            { label: 'Input', color: CHART_COLORS.blueDark },
            { label: 'Output', color: CHART_COLORS.blue },
          ]}
          maxVal={Math.max(...rows.map(d => d.input + d.output))}
          fmt={formatCompactNumber}
        />
      </TabContent>
      <TabContent value="cost" className="pt-3">
        {cost.total > 0 ? (
          <HorizontalBars
            data={cost.rows.map(d => ({
              name: d.name,
              values: [d.cost],
              onClick: onRowClick ? () => onRowClick(d) : undefined,
            }))}
            segments={[{ label: 'Cost', color: CHART_COLORS.purple }]}
            maxVal={Math.max(...cost.rows.map(d => d.cost))}
            fmt={v => formatCost(v, cost.unit)}
          />
        ) : (
          <MetricsCard.NoData message="No cost data yet" />
        )}
      </TabContent>
    </Tabs>
  );
}
