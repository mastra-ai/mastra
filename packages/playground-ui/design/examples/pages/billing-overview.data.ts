import type { BillingOverviewProps } from './billing-overview';

export const exampleBillingOverview: Omit<BillingOverviewProps, 'onOpenPlans' | 'onAddCredits' | 'usageLink'> = {
  planName: 'Starter',
  billingInterval: 'Monthly',
  creditBalance: 42.5,
  upgradeLabel: 'Upgrade to Teams',
  canManageBilling: true,
  meters: [
    { id: 'requests', label: 'Requests', used: 182340, unit: 'requests' },
    { id: 'storage', label: 'Storage', used: 3.4, unit: 'GB' },
    { id: 'connections', label: 'Connections', used: 12, unit: 'active' },
  ],
};
