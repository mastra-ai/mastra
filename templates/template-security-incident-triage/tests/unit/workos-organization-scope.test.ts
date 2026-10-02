import { describe, expect, it, vi } from 'vitest';
import { WorkOsIdentityProvider } from '../../src/providers/identity-provider.js';
import { normalizeWorkOsReal } from '../../src/app/webhooks/normalizers.js';
const member = { userId: 'user_1', organizationId: 'org_1', status: 'active' };
const input = { tenantId: 'org_1', userId: 'user_1' };
const approvalContext = {
  approvalId: 'approval_1',
  fenceToken: 'fence',
  deadline: '2099-01-01T00:00:00.000Z',
};
function harness(data: unknown = [member], allowedUserIds = new Set<string>()) {
  let status = 'active';
  const client = {
    userManagement: {
      listOrganizationMemberships: vi.fn(async () => ({ data })),
      getUser: vi.fn(async () => ({ id: 'user_1' })),
      listSessions: vi.fn(async () => ({
        data: [
          {
            id: 'session_1',
            userId: 'user_1',
            organizationId: 'org_1',
            status,
          },
        ],
      })),
      revokeSession: vi.fn(async () => {
        status = 'revoked';
        return { id: 'session_1', userId: 'user_1', status };
      }),
    },
    organizations: {
      getMembership: vi.fn(async () => ({
        id: 'membership_1',
        ...member,
        roleSlug: 'admin',
      })),
      updateMembership: vi.fn(async () => ({})),
    },
  };
  const provider = new WorkOsIdentityProvider({
    client,
    organizationId: 'org_1',
    allowedUserIds,
    allowedRoleSlugs: new Set(['member', 'admin']),
    authorizeMutation: () => true,
  });
  return { provider, client };
}
describe('WorkOS organization scope without a user allowlist', () => {
  it('reads and revokes for a verified member without configuring their ID', async () => {
    const { provider, client } = harness();
    await expect(provider.getUser(input)).resolves.toMatchObject({
      id: 'user_1',
    });
    await expect(
      provider.revokeSession({
        ...input,
        sessionId: 'session_1',
        approvalContext,
      }),
    ).resolves.toMatchObject({ status: 'revoked' });
    expect(client.userManagement.listOrganizationMemberships).toHaveBeenCalledWith({
      userId: 'user_1',
      organizationId: 'org_1',
      statuses: ['active'],
    });
    expect(client.userManagement.revokeSession).toHaveBeenCalledTimes(1);
  });
  it.each([
    { data: [] },
    { data: [{ ...member, organizationId: 'org_other' }] },
    { data: [{ ...member, userId: 'user_other' }] },
    { data: [{ ...member, status: 'inactive' }] },
    { data: [{ ...member, status: 'pending' }] },
    { data: [{}] },
    { data: null },
  ])('rejects unverified membership %# before reads or mutations', async ({ data }) => {
    const { provider, client } = harness(data);
    await expect(provider.getUser(input)).rejects.toThrow();
    await expect(provider.listSessions(input)).rejects.toThrow();
    await expect(
      provider.revokeSession({
        ...input,
        sessionId: 'session_1',
        approvalContext,
      }),
    ).rejects.toThrow();
    await expect(
      provider.restoreRole({
        ...input,
        membershipId: 'membership_1',
        expectedCurrentRole: 'admin',
        previousRole: 'member',
        approvalContext,
      }),
    ).rejects.toThrow();
    expect(client.userManagement.getUser).not.toHaveBeenCalled();
    expect(client.userManagement.listSessions).not.toHaveBeenCalled();
    expect(client.userManagement.revokeSession).not.toHaveBeenCalled();
    expect(client.organizations.updateMembership).not.toHaveBeenCalled();
  });
  it('keeps explicit restrictions without bypassing organization membership', async () => {
    const { provider, client } = harness([member], new Set(['user_other']));
    await expect(provider.getUser(input)).rejects.toThrow();
    expect(client.userManagement.listOrganizationMemberships).not.toHaveBeenCalled();
    await expect(harness().provider.getUser({ ...input, tenantId: 'org_other' })).rejects.toThrow();
    await expect(harness([], new Set(['user_1'])).provider.getUser(input)).rejects.toThrow();
  });
  it.each(['org_other', ''])('rejects sessions outside verified organization (%s)', async organizationId => {
    const { provider, client } = harness();
    client.userManagement.listSessions.mockResolvedValue({
      data: [
        {
          id: 'session_1',
          userId: 'user_1',
          organizationId,
          status: 'active',
        },
      ],
    });
    await expect(provider.listSessions(input)).resolves.toEqual([]);
    await expect(
      provider.revokeSession({
        ...input,
        sessionId: 'session_1',
        approvalContext,
      }),
    ).rejects.toThrow();
    expect(client.userManagement.revokeSession).not.toHaveBeenCalled();
  });
  it('fails closed on membership lookup failure', async () => {
    const { provider, client } = harness();
    client.userManagement.listOrganizationMemberships.mockRejectedValue(new Error('unavailable'));
    await expect(
      provider.revokeSession({
        ...input,
        sessionId: 'session_1',
        approvalContext,
      }),
    ).rejects.toThrow();
    expect(client.userManagement.revokeSession).not.toHaveBeenCalled();
  });
  it.each(['session.created', 'session.revoked', 'organization_membership.updated'])(
    'enforces organization and optional user/role scope for %s',
    event => {
      const payload = {
        id: 'event_1',
        event,
        created_at: '2026-09-02T12:00:00.000Z',
        data: {
          object: event.startsWith('session.') ? 'session' : 'organization_membership',
          id: 'target_1',
          user_id: 'user_1',
          organization_id: 'org_1',
          ip_address: '200.160.2.3',
          status: 'active',
          role: { slug: 'member' },
          created_at: '2026-09-02T12:00:00.000Z',
          updated_at: '2026-09-02T12:00:00.000Z',
        },
      };
      const scope = {
        organizationId: 'org_1',
        userIds: new Set<string>(),
        roleSlugs: new Set(['member']),
      };
      const normalize = (override = {}) =>
        normalizeWorkOsReal(payload, Buffer.from(JSON.stringify(payload)), {
          ...scope,
          ...override,
        });
      expect(normalize().disposition).toBe('alert');
      expect(normalize({ organizationId: 'org_other' }).disposition).toBe('dead_letter');
      expect(normalize({ userIds: new Set(['user_other']) }).disposition).toBe('dead_letter');
      if (event === 'organization_membership.updated')
        expect(normalize({ roleSlugs: new Set(['admin']) }).disposition).toBe('dead_letter');
    },
  );
});
