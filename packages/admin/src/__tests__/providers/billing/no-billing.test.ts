import { describe, it, expect } from 'vitest';

import { NoBillingProvider } from '../../../providers/billing/no-billing';

describe('NoBillingProvider', () => {
  const provider = new NoBillingProvider();

  describe('getSubscription', () => {
    it('should return enterprise subscription', async () => {
      const subscription = await provider.getSubscription('any-team-id');

      expect(subscription.tier).toBe('enterprise');
      expect(subscription.status).toBe('active');
      expect(subscription.cancelAtPeriodEnd).toBe(false);
    });

    it('should return same subscription for different teams', async () => {
      const sub1 = await provider.getSubscription('team-1');
      const sub2 = await provider.getSubscription('team-2');

      expect(sub1.tier).toEqual(sub2.tier);
      expect(sub1.status).toEqual(sub2.status);
    });
  });

  describe('getUsage', () => {
    it('should return zero usage', async () => {
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const usage = await provider.getUsage('any-team-id', monthAgo, now);

      expect(usage.buildMinutes).toBe(0);
      expect(usage.activeDeployments).toBe(0);
      expect(usage.storageGb).toBe(0);
      expect(usage.dataTransferGb).toBe(0);
    });
  });

  describe('canPerformAction', () => {
    it('should always return true', async () => {
      expect(await provider.canPerformAction('team-id', 'deploy')).toBe(true);
      expect(await provider.canPerformAction('team-id', 'build')).toBe(true);
    });
  });

  describe('recordUsage', () => {
    it('should be a no-op', async () => {
      await expect(provider.recordUsage('team-id', 'buildMinutes', 10)).resolves.toBeUndefined();
    });
  });
});
