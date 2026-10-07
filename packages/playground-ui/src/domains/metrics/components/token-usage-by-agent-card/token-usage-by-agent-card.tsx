import { useTokenUsageByAgentMetrics } from '@mastra/react/hooks/metrics';
import { useState } from 'react';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';
import type { DrilldownScope } from '../../drilldown';
import { useMetricsFilters } from '../../hooks/use-metrics-filters';
import { OpenInTracesButton } from '../card-action-buttons';
import { MetricsTableSkeleton } from '../metrics-table-skeleton';
import { TokenUsageByAgentCardContent } from './token-usage-by-agent-card-content';
import { TokenUsageByAgentCardLayout } from './token-usage-by-agent-card-layout';
import { summarizeCost, tokenUsageRowScope, tokenUsageTracesScope } from './token-usage-by-agent-card.utils';
import type { TokenUsageTab } from './token-usage-by-agent-card.utils';
import { formatCompactNumber, formatCost } from '@/lib/cost';

export interface TokenUsageByAgentCardProps {
  /** Opens agent traces. No handler, no button. */
  onOpenTraces?: (scope: DrilldownScope) => void;
  /** Opens traces for a clicked agent. No handler, bars are not clickable. */
  onRowClick?: (scope: DrilldownScope) => void;
}

export function TokenUsageByAgentCard({ onOpenTraces, onRowClick }: TokenUsageByAgentCardProps) {
  const { data, isLoading, isError } = useTokenUsageByAgentMetrics(useMetricsFilters());
  const [activeTab, setActiveTab] = useState<TokenUsageTab>('tokens');
  const actions = onOpenTraces ? <OpenInTracesButton onClick={() => onOpenTraces(tokenUsageTracesScope)} /> : undefined;

  if (isLoading) {
    return (
      <TokenUsageByAgentCardLayout actions={actions} summary={<MetricsCard.Summary value="—" label="Total tokens" />}>
        <MetricsTableSkeleton label="Loading token usage" />
      </TokenUsageByAgentCardLayout>
    );
  }

  if (isError || !data) {
    return (
      <TokenUsageByAgentCardLayout actions={actions}>
        <MetricsCard.Error message="Failed to load token usage data" className="h-full" />
      </TokenUsageByAgentCardLayout>
    );
  }

  const cost = summarizeCost(data);
  const showCost = activeTab === 'cost' && cost.total > 0;
  const totalTokens = data.reduce((s, d) => s + d.total, 0);
  const summary =
    data.length === 0 ? undefined : showCost ? (
      <MetricsCard.Summary value={formatCost(cost.total, cost.unit)} label="Total cost" />
    ) : (
      <MetricsCard.Summary value={formatCompactNumber(totalTokens)} label="Total tokens" />
    );

  return (
    <TokenUsageByAgentCardLayout actions={actions} summary={summary}>
      <TokenUsageByAgentCardContent
        rows={data}
        cost={cost}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRowClick={onRowClick ? row => onRowClick(tokenUsageRowScope(row)) : undefined}
      />
    </TokenUsageByAgentCardLayout>
  );
}
