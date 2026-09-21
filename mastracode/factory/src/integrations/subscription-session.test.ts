import { beforeEach, describe, expect, it, vi } from 'vitest';

const prime = vi.fn(async () => undefined);
vi.mock('../routes/tenant-credentials.js', () => ({
  primeTenantCredentialsForRequestContext: (context: unknown) => prime(context as never),
}));

import { subscriptionRunContext } from './subscription-session.js';
import type { SubscriptionSessionRow } from './subscription-session.js';

function row(overrides: Partial<SubscriptionSessionRow['data']> = {}, orgId = 'org-1'): SubscriptionSessionRow {
  return {
    id: 'sub-1',
    orgId,
    targetKey: 'change-request:x',
    sessionId: 'session-1',
    resourceId: 'factory-1',
    threadId: 'thread-1',
    sessionScope: '',
    status: 'open',
    data: { projectRepositoryId: 'repo-1', subscribedByUserId: 'user-1', ...overrides },
    createdAt: new Date('2026-09-21T00:00:00Z'),
    updatedAt: new Date('2026-09-21T00:00:00Z'),
  };
}

beforeEach(() => {
  prime.mockClear();
});

describe('subscriptionRunContext', () => {
  it('runs as the subscribing user in the subscription organization and primes credentials', async () => {
    const context = await subscriptionRunContext(row(), undefined);
    expect(context?.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
    expect(prime).toHaveBeenCalledTimes(1);
    expect(prime.mock.calls[0]?.[0]).toBe(context);
  });

  it('falls back to the Factory session owner when the row names no user', async () => {
    const getBySessionId = vi.fn(async () => ({ userId: 'owner-2', orgId: 'org-2' }));
    const context = await subscriptionRunContext(row({ subscribedByUserId: null }), { sessions: { getBySessionId } });
    expect(getBySessionId).toHaveBeenCalledWith('session-1');
    expect(context?.get('user')).toEqual({ workosId: 'owner-2', organizationId: 'org-2' });
  });

  it('returns no context, and does not prime, when no identity can be resolved', async () => {
    const context = await subscriptionRunContext(row({ subscribedByUserId: null }), {
      sessions: { getBySessionId: async () => null },
    });
    expect(context).toBeUndefined();
    expect(prime).not.toHaveBeenCalled();
  });

  it('survives a priming failure', async () => {
    prime.mockRejectedValueOnce(new Error('storage down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const context = await subscriptionRunContext(row(), undefined);
    expect(context?.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
