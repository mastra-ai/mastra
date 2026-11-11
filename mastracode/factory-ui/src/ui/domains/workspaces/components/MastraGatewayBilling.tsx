import { formatCost } from '@mastra/playground-ui/utils/cost';

import { useMastraGatewayCreditsQuery } from '../../../../hooks/use-providers';

const BILLING = 'Pay with your organization’s Mastra credits';

export function MastraGatewayBilling() {
  const { data: credits } = useMastraGatewayCreditsQuery();
  if (credits?.unlimited || credits?.remaining === undefined) return BILLING;
  return `${BILLING} (${formatCost(credits.remaining)} left)`;
}
