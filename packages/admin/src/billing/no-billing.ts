import type { BillingProvider, SubscriptionInfo, UsageMetrics } from './base';

/**
 * No-op billing provider for self-hosted deployments.
 * Returns enterprise subscription for all teams.
 */
export class NoBillingProvider implements BillingProvider {
  async getSubscription(_teamId: string): Promise<SubscriptionInfo> {
    return {
      tier: 'enterprise',
      status: 'active',
      currentPeriodStart: new Date(0),
      currentPeriodEnd: new Date('2099-12-31'),
      cancelAtPeriodEnd: false,
    };
  }

  async getUsage(_teamId: string, _periodStart: Date, _periodEnd: Date): Promise<UsageMetrics> {
    return {
      buildMinutes: 0,
      activeDeployments: 0,
      storageGb: 0,
      dataTransferGb: 0,
    };
  }

  async canPerformAction(_teamId: string, _action: string): Promise<boolean> {
    return true;
  }

  async recordUsage(_teamId: string, _metric: keyof UsageMetrics, _amount: number): Promise<void> {
    // No-op for self-hosted
  }
}
