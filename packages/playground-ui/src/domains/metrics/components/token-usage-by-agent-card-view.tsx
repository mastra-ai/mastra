import { useState } from 'react';
import type { ReactNode } from 'react';
import { HorizontalBars } from '../../../ds/components/HorizontalBars/horizontal-bars';
import { MetricsCard } from '../../../ds/components/MetricsCard/metrics-card';
import { TabContent } from '../../../ds/components/Tabs/tabs-content';
import { TabList } from '../../../ds/components/Tabs/tabs-list';
import { Tabs } from '../../../ds/components/Tabs/tabs-root';
import { Tab } from '../../../ds/components/Tabs/tabs-tab';
import type { LinkComponent } from '../../../ds/types/link-component';
import type { TokenUsageByAgentRow } from '../hooks/use-token-usage-by-agent-metrics';
import { CHART_COLORS, formatCompact, formatCost } from './metrics-utils';

export interface TokenUsageByAgentCardViewProps {
  data: TokenUsageByAgentRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Optional drilldown: returns an href for a single row in either tab. */
  getRowHref?: (row: TokenUsageByAgentRow) => string | undefined;
  /** Optional slot for top-bar action buttons. */
  actions?: ReactNode;
  /** Override how drilldown links are rendered. Defaults to `<a>`. */
  LinkComponent?: LinkComponent;
}

type TokenUsageTab = 'tokens' | 'cost';

function isTokenUsageTab(value: string): value is TokenUsageTab {
  return value === 'tokens' || value === 'cost';
}

type TokenUsageTabs = {
  activeTab: TokenUsageTab;
  onTabChange: (tab: TokenUsageTab) => void;
};

type TokenUsageLinks = {
  getRowHref: TokenUsageByAgentCardViewProps['getRowHref'];
  LinkComponent: TokenUsageByAgentCardViewProps['LinkComponent'];
};

function getCostRows(rows: TokenUsageByAgentRow[]) {
  return rows.filter((d): d is TokenUsageByAgentRow & { cost: number } => d.cost != null && d.cost > 0);
}

function TokenUsageByAgentContent({
  rows,
  tabs,
  links,
  costUnit,
}: {
  rows: TokenUsageByAgentRow[];
  tabs: TokenUsageTabs;
  links: TokenUsageLinks;
  costUnit: string | null;
}) {
  const costRows = getCostRows(rows);
  const hasCostData = costUnit != null && costRows.length > 0;

  return (
    <Tabs
      defaultTab="tokens"
      value={tabs.activeTab}
      onValueChange={v => {
        if (isTokenUsageTab(v)) tabs.onTabChange(v);
      }}
      className="grid grid-rows-[auto_1fr] overflow-y-auto h-full"
    >
      <TabList>
        <Tab value="tokens">Tokens</Tab>
        <Tab value="cost">Cost</Tab>
      </TabList>
      <TabContent value="tokens">
        <HorizontalBars
          LinkComponent={links.LinkComponent}
          data={rows.map(d => ({
            name: d.name,
            values: [d.input, d.output],
            href: links.getRowHref?.(d),
          }))}
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
            LinkComponent={links.LinkComponent}
            data={costRows
              .slice()
              .sort((a, b) => b.cost - a.cost)
              .map(d => ({ name: d.name, values: [d.cost], href: links.getRowHref?.(d) }))}
            segments={[{ label: 'Cost', color: CHART_COLORS.purple }]}
            maxVal={Math.max(...costRows.map(d => d.cost))}
            fmt={v => formatCost(v, costUnit)}
          />
        ) : (
          <MetricsCard.NoData message="No cost data yet" />
        )}
      </TabContent>
    </Tabs>
  );
}

export function TokenUsageByAgentCardView({
  data,
  isLoading,
  isError,
  getRowHref,
  actions,
  LinkComponent,
}: TokenUsageByAgentCardViewProps) {
  const [activeTab, setActiveTab] = useState<TokenUsageTab>('tokens');

  const rows = data ?? [];
  const hasData = rows.length > 0;
  const totalTokens = rows.reduce((s, d) => s + d.total, 0);
  const costRows = getCostRows(rows);
  const uniqueCostUnits = new Set(costRows.map(d => d.costUnit ?? 'usd'));
  const hasSingleCostUnit = uniqueCostUnits.size <= 1;
  const costUnit = hasSingleCostUnit ? ([...uniqueCostUnits][0] ?? 'usd') : null;
  const totalCost = hasSingleCostUnit ? costRows.reduce((s, d) => s + d.cost, 0) : 0;
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
        {hasData && actions ? <MetricsCard.Actions>{actions}</MetricsCard.Actions> : null}
      </MetricsCard.TopBar>
      {isLoading && <MetricsCard.Loading />}
      {!isLoading && isError && <MetricsCard.Error message="Failed to load token usage data" />}
      {!isLoading && !isError && (
        <MetricsCard.Content>
          {rows.length === 0 ? (
            <MetricsCard.NoData message="No token usage data yet" />
          ) : (
            <TokenUsageByAgentContent
              rows={rows}
              tabs={{ activeTab, onTabChange: setActiveTab }}
              links={{ getRowHref, LinkComponent }}
              costUnit={costUnit}
            />
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
