import { EntityType } from '@mastra/core/observability';
import type { ModelUsageRow } from '@mastra/react/hooks/metrics';
import type { DrilldownScope } from '../../drilldown';
import { formatCost } from '@/lib/cost';

export const modelUsageTracesScope: DrilldownScope = { rootEntityType: EntityType.AGENT };

export function modelUsageRowScope(row: ModelUsageRow): DrilldownScope {
  return { rootEntityType: EntityType.AGENT, model: row.model, provider: row.provider };
}

/** Sums row costs. Rows priced in different units can't be summed, so they read as "Mixed". */
export function formatTotalCost(rows: ModelUsageRow[]): string {
  const totalCost = rows.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  const units = new Set<string>();
  for (const row of rows) {
    if (row.cost != null && row.costUnit) units.add(row.costUnit);
  }
  if (units.size > 1) return 'Mixed';
  if (totalCost <= 0) return '—';
  return units.size === 1 ? formatCost(totalCost, [...units][0]) : formatCost(totalCost);
}
