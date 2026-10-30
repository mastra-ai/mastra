import type { BreakdownRow } from '../../lib/breakdown';
import { DASH, formatCost } from '../../lib/breakdown-table';
import { BreakdownNotPriced } from './breakdown-not-priced';

export function BreakdownCostCell({ row }: { row: BreakdownRow }) {
  if (row.cost === undefined) return row.tokens ? <BreakdownNotPriced /> : DASH;
  return formatCost(row.cost, row.costUnit);
}
