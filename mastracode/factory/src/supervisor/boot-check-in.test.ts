import { describe, expect, it, vi } from 'vitest';

import { builtInFactoryRules } from '../rules/defaults.js';
import type { FactoryRules } from '../rules/types.js';
import { FACTORY_BOOT_CHECK_IN_COOLDOWN_MS, FactoryBootCheckIn } from './boot-check-in.js';

function fixture(options: { rules?: FactoryRules; tenants?: unknown[] } = {}) {
  const created: Array<Record<string, unknown>> = [];
  const storage = {
    listTenantsWithOpenWorkItems: vi
      .fn()
      .mockResolvedValue(
        options.tenants ?? [
          { orgId: 'org-1', factoryProjectId: 'project-1', openItemCount: 3, supervisorUserId: 'user-1' },
        ],
      ),
    // Mirror the tenant-unique index on `idempotency_key`: a repeat insert for
    // the same bucket returns null instead of a second row.
    createBootCheckInNotification: vi.fn().mockImplementation(async (input: Record<string, unknown>) => {
      const key = `${input.orgId}\u0000${input.factoryProjectId}\u0000${input.bucketKey}`;
      if (created.some(row => row.key === key)) return null;
      const record = { key, id: `notification-${created.length + 1}`, ...input };
      created.push(record);
      return record;
    }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const rules = options.rules ?? builtInFactoryRules();
  return { storage, audit, rules, created };
}

describe('FactoryBootCheckIn', () => {
  it('enqueues one wake per tenant that still has open work', async () => {
    const { storage, audit, rules } = fixture();

    const result = await new FactoryBootCheckIn({ storage, audit, rules }).run();

    expect(result).toEqual({ enqueued: 1, skipped: 0 });
    expect(storage.createBootCheckInNotification).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', factoryProjectId: 'project-1', supervisorUserId: 'user-1' }),
    );
    expect(storage.createBootCheckInNotification.mock.calls[0]![0].summary).toContain('3 work item(s) are still open');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'factory.supervisor.boot_check_in',
        metadata: expect.objectContaining({ openItemCount: 3 }),
      }),
    );
  });

  it('collapses a restart storm inside the cooldown window into a single wake', async () => {
    const { storage, audit, rules } = fixture();
    let clock = new Date('2030-01-01T00:00:00.000Z').getTime();
    const boot = () => new FactoryBootCheckIn({ storage, audit, rules, now: () => new Date(clock) }).run();

    const first = await boot();
    clock += 30_000;
    const second = await boot();
    clock += 60_000;
    const third = await boot();

    expect(first).toEqual({ enqueued: 1, skipped: 0 });
    expect(second).toEqual({ enqueued: 0, skipped: 1 });
    expect(third).toEqual({ enqueued: 0, skipped: 1 });
    expect(audit.record).toHaveBeenCalledOnce();
  });

  it('wakes again once the cooldown window elapses', async () => {
    const { storage, audit, rules } = fixture();
    let clock = new Date('2030-01-01T00:00:00.000Z').getTime();
    const boot = () => new FactoryBootCheckIn({ storage, audit, rules, now: () => new Date(clock) }).run();

    await boot();
    clock += FACTORY_BOOT_CHECK_IN_COOLDOWN_MS;

    await expect(boot()).resolves.toEqual({ enqueued: 1, skipped: 0 });
  });

  it('stays silent when no tenant has open work', async () => {
    const { storage, audit, rules } = fixture({ tenants: [] });

    await expect(new FactoryBootCheckIn({ storage, audit, rules }).run()).resolves.toEqual({
      enqueued: 0,
      skipped: 0,
    });
    expect(storage.createBootCheckInNotification).not.toHaveBeenCalled();
  });

  it('stays silent when the Factory opts out', async () => {
    const rules = { ...builtInFactoryRules(), supervisor: { checkInOnBoot: false } } as FactoryRules;
    const { storage, audit } = fixture();

    await expect(new FactoryBootCheckIn({ storage, audit, rules }).run()).resolves.toEqual({
      enqueued: 0,
      skipped: 0,
    });
    expect(storage.listTenantsWithOpenWorkItems).not.toHaveBeenCalled();
  });

  it('never lets one tenant failure block another tenant or the boot itself', async () => {
    const { storage, audit, rules } = fixture({
      tenants: [
        { orgId: 'org-1', factoryProjectId: 'project-1', openItemCount: 1, supervisorUserId: 'user-1' },
        { orgId: 'org-2', factoryProjectId: 'project-2', openItemCount: 2, supervisorUserId: 'user-2' },
      ],
    });
    storage.createBootCheckInNotification.mockRejectedValueOnce(new Error('storage unavailable'));
    const onError = vi.fn();

    const result = await new FactoryBootCheckIn({ storage, audit, rules, onError }).run();

    expect(result).toEqual({ enqueued: 1, skipped: 0 });
    expect(onError).toHaveBeenCalledOnce();
    expect(storage.createBootCheckInNotification).toHaveBeenCalledTimes(2);
  });
});
