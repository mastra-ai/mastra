import { formatCost } from '@mastra/playground-ui/utils/cost';

import type { MastraGatewayCredits } from '../../../../api/types';

const BILLING = 'Billed to your organization’s Mastra credits';

const WHOLE_DOLLARS = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function formatWholeDollars(amount: number): string {
  return WHOLE_DOLLARS.format(amount);
}

export function mastraGatewayBilling(credits: MastraGatewayCredits | undefined): string {
  if (credits?.unlimited) return `${BILLING} · unlimited`;
  if (credits?.remaining == null) return BILLING;
  return `${BILLING} · ${formatCost(credits.remaining)} left`;
}
