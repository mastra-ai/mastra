/**
 * Subscription tier information.
 */
export interface SubscriptionInfo {
  tier: 'free' | 'team' | 'enterprise' | string;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

/**
 * Usage metrics for billing.
 */
export interface UsageMetrics {
  buildMinutes: number;
  activeDeployments: number;
  storageGb: number;
  dataTransferGb: number;
}

/**
 * Abstract interface for billing operations.
 */
export interface BillingProvider {
  /**
   * Get subscription info for a team.
   */
  getSubscription(teamId: string): Promise<SubscriptionInfo | null>;

  /**
   * Get usage metrics for a team.
   */
  getUsage(teamId: string, periodStart: Date, periodEnd: Date): Promise<UsageMetrics>;

  /**
   * Check if a team can perform an action based on billing.
   */
  canPerformAction(teamId: string, action: string): Promise<boolean>;

  /**
   * Record usage for billing.
   */
  recordUsage(teamId: string, metric: keyof UsageMetrics, amount: number): Promise<void>;
}
