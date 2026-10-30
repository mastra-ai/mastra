import type { BreakdownRow } from '../../lib/breakdown';
import { DASH, formatCost } from '../../lib/breakdown-table';

export function BreakdownCostCell({ row }: { row: BreakdownRow }) {
  if (row.cost === undefined) {
    // Tokens without a price: say so rather than show $0.
    return row.tokens ? <span title="No price for this model">Not priced</span> : DASH;
  }
  return formatCost(row.cost, row.costUnit);
}
