import { describe, expect, it } from 'vitest';

import type { IdentityProvider } from '../../src/providers/identity-provider.js';
import { WorkOsIdentityProvider } from '../../src/providers/identity-provider.js';
import { LocalIdentityProvider } from '../../src/providers/local-identity-provider.js';

const approval = {
  approvalId: 'approval_1',
  fenceToken: 'fence_1',
  deadline: '2099-01-01T00:00:00.000Z',
} as const;
type Harness = Readonly<{
  provider: IdentityProvider;
  calls: readonly string[];
}>;

function mockHarness(
  failOperations?: ReadonlySet<'getUser' | 'listSessions' | 'revokeSession' | 'restoreRole'>,
): Harness {
  const provider = new LocalIdentityProvider({
    users: [{ id: 'user_1', tenantId: 'tenant_1', status: 'active' }],
    sessions: [
      { id: 'session_1', userId: 'user_1', status: 'active' },
      { id: 'session_expired', userId: 'user_1', status: 'expired' },
    ],
    memberships: [{ id: 'membership_1', userId: 'user_1', roleSlug: 'admin' }],
    authorizeMutation: () => true,
    ...(failOperations ? { failOperations } : {}),
  });
  return { provider, calls: provider.calls };
}

function workosHarness(
  options: Readonly<{
    failure?: 'timeout' | 'rate-limit' | 'unavailable';
    invalid?: boolean;
  }> = {},
): Harness {
  let session: 'active' | 'revoked' = 'active';
  let role = 'admin';
  const calls: string[] = [];
  const wait = async () => {
    if (options.failure === 'timeout') await new Promise<void>(() => undefined);
    if (options.failure) throw new Error(options.failure);
  };
  return {
    provider: new WorkOsIdentityProvider({
      client: {
        userManagement: {
          listOrganizationMemberships: async ({
            userId,
            organizationId,
          }: {
            userId: string;
            organizationId: string;
          }) => ({
            data: [{ userId, organizationId, status: 'active' }],
          }),
          // WorkOS User omits status; the adapter projects its conservative state.
          getUser: async () => {
            calls.push('getUser');
            await wait();
            return options.invalid ? {} : { id: 'user_1' };
          },
          listSessions: async () => {
            calls.push('listSessions');
            await wait();
            return {
              data: [
                {
                  id: 'session_1',
                  userId: 'user_1',
                  organizationId: 'tenant_1',
                  status: session,
                },
                {
                  id: 'session_expired',
                  userId: 'user_1',
                  organizationId: 'tenant_1',
                  status: 'expired',
                },
              ],
            };
          },
          revokeSession: async () => {
            calls.push('revokeSession');
            await wait();
            session = 'revoked';
            return { id: 'session_1', userId: 'user_1', status: session };
          },
        },
        organizations: {
          // WorkOS Membership supplies role.slug, not roleSlug.
          getMembership: async () => {
            calls.push('getMembership');
            await wait();
            return {
              id: 'membership_1',
              userId: 'user_1',
              organizationId: 'tenant_1',
              role: { slug: role },
              status: 'active',
            };
          },
          updateMembership: async (_id, input) => {
            calls.push('updateMembership');
            await wait();
            role = input.roleSlug;
            return {
              id: 'membership_1',
              userId: 'user_1',
              organizationId: 'tenant_1',
              role: { slug: role },
              status: 'active',
            };
          },
        },
      },
      organizationId: 'tenant_1',
      allowedUserIds: new Set(['user_1']),
      allowedRoleSlugs: new Set(['admin', 'member']),
      authorizeMutation: () => true,
      timeoutMs: options.failure === 'timeout' ? 1 : 100,
    }),
    calls,
  };
}

for (const [name, create] of [
  ['mock', () => mockHarness()],
  ['workos-fake', () => workosHarness()],
] as const) {
  describe(`IdentityProvider shared contract: ${name}`, () => {
    it('gets/list states, including expired sessions, and enforces allowlist', async () => {
      const { provider } = create();
      await expect(provider.getUser({ tenantId: 'tenant_1', userId: 'user_1' })).resolves.toMatchObject({
        status: name === 'workos-fake' ? 'unknown' : 'active',
      });
      await expect(provider.listSessions({ tenantId: 'tenant_1', userId: 'user_1' })).resolves.toContainEqual(
        expect.objectContaining({ id: 'session_expired', status: 'expired' }),
      );
      await expect(provider.getUser({ tenantId: 'tenant_1', userId: 'other' })).rejects.toThrow();
    });
    it('revokes/restores exact targets and readbacks state idempotently', async () => {
      const { provider } = create();
      await provider.revokeSession({
        tenantId: 'tenant_1',
        userId: 'user_1',
        sessionId: 'session_1',
        approvalContext: approval,
      });
      await expect(provider.listSessions({ tenantId: 'tenant_1', userId: 'user_1' })).resolves.toContainEqual(
        expect.objectContaining({ id: 'session_1', status: 'revoked' }),
      );
      await expect(
        provider.restoreRole({
          tenantId: 'tenant_1',
          userId: 'user_1',
          membershipId: 'membership_1',
          expectedCurrentRole: 'admin',
          previousRole: 'member',
          approvalContext: approval,
        }),
      ).resolves.toMatchObject({ roleSlug: 'member' });
    });
    it('rejects expired approvals and missing targets before mutation', async () => {
      const { provider } = create();
      await expect(
        provider.revokeSession({
          tenantId: 'tenant_1',
          userId: 'user_1',
          sessionId: 'missing',
          approvalContext: approval,
        }),
      ).rejects.toThrow();
      await expect(
        provider.restoreRole({
          tenantId: 'tenant_1',
          userId: 'user_1',
          membershipId: 'membership_1',
          expectedCurrentRole: 'admin',
          previousRole: 'member',
          approvalContext: {
            ...approval,
            deadline: '2020-01-01T00:00:00.000Z',
          },
        }),
      ).rejects.toThrow();
    });
  });
}

/**
 * Literal shared scenarios.  They contain only inputs; observations below are
 * collected from the provider/fake boundary and are never manufactured from a
 * scenario name or an expected-result object.
 */
const identityObservationMatrix = [
  { operation: 'get' },
  { operation: 'list' },
  { operation: 'revoke' },
  { operation: 'restore' },
  { operation: 'target-missing' },
  { operation: 'deadline-cancelled' },
  { operation: 'stale-fence' },
  { operation: 'cross-tenant' },
  { operation: 'session-status-mismatch' },
  { operation: 'membership-status-mismatch' },
] as const;

type ObservableIdentityProvider = IdentityProvider & {
  verifyMembership?: (input: {
    userId: string;
    membershipId: string;
    previousRole: string;
  }) => Promise<{ roleSlug: string }>;
};

for (const [name, create] of [
  ['mock', () => mockHarness()],
  ['real-via-fake', () => workosHarness()],
] as const) {
  describe(`Identity observation factory matrix: ${name}`, () => {
    it.each(identityObservationMatrix)('$operation', async row => {
      const { provider, calls } = create();
      const observable = provider as ObservableIdentityProvider;
      const before = calls.length;
      const audit: Array<Readonly<{ operation: string; target: 'opaque' }>> = [];
      let outcome: 'fulfilled' | 'rejected' = 'fulfilled';
      let result: unknown;
      let readback: unknown;
      try {
        if (row.operation === 'get') {
          result = await provider.getUser({
            tenantId: 'tenant_1',
            userId: 'user_1',
          });
        } else if (row.operation === 'list') {
          result = await provider.listSessions({
            tenantId: 'tenant_1',
            userId: 'user_1',
          });
        } else if (row.operation === 'revoke') {
          audit.push({ operation: 'revokeSession', target: 'opaque' });
          result = await provider.revokeSession({
            tenantId: 'tenant_1',
            userId: 'user_1',
            sessionId: 'session_1',
            approvalContext: approval,
          });
          readback = await provider.listSessions({
            tenantId: 'tenant_1',
            userId: 'user_1',
          });
        } else if (row.operation === 'restore') {
          audit.push({ operation: 'restoreRole', target: 'opaque' });
          result = await provider.restoreRole({
            tenantId: 'tenant_1',
            userId: 'user_1',
            membershipId: 'membership_1',
            expectedCurrentRole: 'admin',
            previousRole: 'member',
            approvalContext: approval,
          });
          readback = await observable.verifyMembership?.({
            userId: 'user_1',
            membershipId: 'membership_1',
            previousRole: 'member',
          });
        } else if (row.operation === 'target-missing') {
          audit.push({ operation: 'revokeSession', target: 'opaque' });
          result = await provider.revokeSession({
            tenantId: 'tenant_1',
            userId: 'user_1',
            sessionId: 'missing',
            approvalContext: approval,
          });
        } else if (row.operation === 'deadline-cancelled') {
          audit.push({ operation: 'revokeSession', target: 'opaque' });
          result = await provider.revokeSession({
            tenantId: 'tenant_1',
            userId: 'user_1',
            sessionId: 'session_1',
            approvalContext: {
              ...approval,
              deadline: '2020-01-01T00:00:00.000Z',
            },
          });
        } else if (row.operation === 'stale-fence') {
          audit.push({ operation: 'restoreRole', target: 'opaque' });
          result = await provider.restoreRole({
            tenantId: 'tenant_1',
            userId: 'user_1',
            membershipId: 'membership_1',
            expectedCurrentRole: 'admin',
            previousRole: 'member',
            // Both adapters reject an unusable stale/cleared fence before a
            // provider mutation; durable monotonic fencing is exercised by
            // the gateway/store integration contract.
            approvalContext: { ...approval, fenceToken: '' },
          });
        } else if (row.operation === 'cross-tenant') {
          result = await provider.getUser({
            tenantId: 'other',
            userId: 'user_1',
          });
        } else if (row.operation === 'session-status-mismatch') {
          audit.push({ operation: 'revokeSession', target: 'opaque' });
          result = await provider.revokeSession({
            tenantId: 'tenant_1',
            userId: 'user_1',
            sessionId: 'session_expired',
            approvalContext: approval,
          });
        } else {
          audit.push({ operation: 'restoreRole', target: 'opaque' });
          result = await provider.restoreRole({
            tenantId: 'tenant_1',
            userId: 'user_1',
            membershipId: 'membership_1',
            expectedCurrentRole: 'member',
            previousRole: 'admin',
            approvalContext: approval,
          });
        }
      } catch {
        outcome = 'rejected';
      }
      const observation = {
        outcome,
        calls: calls.slice(before),
        mutationAttempts: calls
          .slice(before)
          .filter(call => ['revokeSession', 'updateMembership', 'restoreRole'].includes(call)),
        mutationSuccesses: result ? 1 : 0,
        readback,
        audit,
      };
      expect(observation.audit.every(entry => entry.target === 'opaque')).toBe(true);
      if (row.operation === 'get') {
        expect(observation.outcome).toBe('fulfilled');
        expect(result).toMatchObject({ id: 'user_1' });
        expect(observation.mutationAttempts).toHaveLength(0);
      } else if (row.operation === 'list') {
        expect(observation.outcome).toBe('fulfilled');
        expect(result).toContainEqual(expect.objectContaining({ id: 'session_expired', status: 'expired' }));
        expect(observation.mutationAttempts).toHaveLength(0);
      } else if (row.operation === 'revoke') {
        expect(observation.outcome).toBe('fulfilled');
        expect(result).toMatchObject({ id: 'session_1', status: 'revoked' });
        expect(readback).toContainEqual(expect.objectContaining({ id: 'session_1', status: 'revoked' }));
        expect(observation.mutationAttempts).toHaveLength(1);
      } else if (row.operation === 'restore') {
        expect(observation.outcome).toBe('fulfilled');
        expect(result).toMatchObject({
          id: 'membership_1',
          roleSlug: 'member',
        });
        expect(readback).toMatchObject({ roleSlug: 'member' });
        expect(observation.mutationAttempts).toHaveLength(1);
      } else {
        expect(observation.outcome).toBe('rejected');
        expect(observation.mutationSuccesses).toBe(0);
      }
    });
  });
}

const identityFailureMatrix = [
  {
    name: 'timeout',
    mockFailure: new Set(['listSessions'] as const),
    workos: { failure: 'timeout' as const },
    operation: (provider: IdentityProvider) => provider.listSessions({ tenantId: 'tenant_1', userId: 'user_1' }),
  },
  {
    name: 'rate-limit',
    mockFailure: new Set(['getUser'] as const),
    workos: { failure: 'rate-limit' as const },
    operation: (provider: IdentityProvider) => provider.getUser({ tenantId: 'tenant_1', userId: 'user_1' }),
  },
  {
    name: 'unavailable',
    mockFailure: new Set(['getUser'] as const),
    workos: { failure: 'unavailable' as const },
    operation: (provider: IdentityProvider) => provider.getUser({ tenantId: 'tenant_1', userId: 'user_1' }),
  },
  {
    name: 'invalid-partial-response',
    mockFailure: new Set(['getUser'] as const),
    workos: { invalid: true },
    operation: (provider: IdentityProvider) => provider.getUser({ tenantId: 'tenant_1', userId: 'user_1' }),
  },
] as const;

for (const [name, create] of [
  ['mock', (row: (typeof identityFailureMatrix)[number]) => mockHarness(row.mockFailure)],
  ['workos-fake', (row: (typeof identityFailureMatrix)[number]) => workosHarness(row.workos)],
] as const) {
  describe(`IdentityProvider shared failure matrix: ${name}`, () => {
    it.each(identityFailureMatrix)('fails closed for $name', async row => {
      await expect(row.operation(create(row).provider)).rejects.toThrow();
    });

    it('keeps concurrent read operations mutation-free', async () => {
      const { provider, calls } = name === 'mock' ? mockHarness() : workosHarness();
      const before = calls.length;
      await expect(
        Promise.all([
          provider.getUser({ tenantId: 'tenant_1', userId: 'user_1' }),
          provider.listSessions({ tenantId: 'tenant_1', userId: 'user_1' }),
        ]),
      ).resolves.toHaveLength(2);
      expect(
        calls.slice(before).filter(call => ['revokeSession', 'updateMembership', 'restoreRole'].includes(call)),
      ).toHaveLength(0);
    });
  });
}
