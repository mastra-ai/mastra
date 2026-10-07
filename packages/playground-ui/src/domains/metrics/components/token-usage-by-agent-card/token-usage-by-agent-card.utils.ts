import { EntityType } from '@mastra/core/observability';
import type { TokenUsageByAgentRow } from '@mastra/react/hooks/metrics';
import type { DrilldownScope } from '../../drilldown';

export type TokenUsageTab = 'tokens' | 'cost';

export function isTokenUsageTab(value: string): value is TokenUsageTab {
  return value === 'tokens' || value === 'cost';
}

export const tokenUsageTracesScope: DrilldownScope = { rootEntityType: EntityType.AGENT };

export function tokenUsageRowScope(row: TokenUsageByAgentRow): DrilldownScope {
  return { rootEntityType: EntityType.AGENT, entityName: row.name };
}

export type CostRow = TokenUsageByAgentRow & { cost: number };

export interface TokenUsageCostSummary {
  rows: CostRow[];
  total: number;
  /** Undefined when rows mix cost units and can't be summed. */
  unit: string | undefined;
}

export function summarizeCost(rows: TokenUsageByAgentRow[]): TokenUsageCostSummary {
  const costRows = rows.filter((d): d is CostRow => d.cost != null && d.cost > 0);
  const units = new Set(costRows.map(d => d.costUnit ?? 'usd'));
  if (units.size > 1) return { rows: costRows, total: 0, unit: undefined };

  return {
    rows: costRows.slice().sort((a, b) => b.cost - a.cost),
    total: costRows.reduce((s, d) => s + d.cost, 0),
    unit: [...units][0] ?? 'usd',
  };
}
