import { afterEach, describe, expect, it, vi } from 'vitest';

import { readIntegrationConfig, readAgentConfig } from '../../src/env.js';
import { IpinfoLiteProvider } from '../../src/providers/geoip-provider.js';
import { GeoIpIdentityEvidenceProvider } from '../../src/providers/geoip-evidence-provider.js';
import { LinearIncidentProvider, type LinearIssueClient } from '../../src/providers/linear-incident-provider.js';
import { WorkOsIdentityProvider } from '../../src/providers/identity-provider.js';
import { LocalIdentityProvider } from '../../src/providers/local-identity-provider.js';
import {
  DisabledIdentityEvidenceProvider,
  WorkOsIdentityEvidenceProvider,
} from '../../src/providers/identity-evidence-provider.js';
import { createIncidentProvider } from '../../src/providers/runtime-factory.js';
import { identitySnapshotIntegrityHash } from '../../src/containment/gateway.js';
import {
  integrationApprovalContext,
  integrationPublicIps,
  stagingIpinfoEnvironment,
} from '../fixtures/integrations.js';
import { createTempDatabase } from '../helpers/temp-libsql.js';

const base = { RUNTIME_MODE: 'local' };
const statusStateIds = {
  received: 'state_received',
  investigating: 'state_investigating',
  awaiting_approval: 'state_awaiting_approval',
  approved: 'state_approved',
  rejected: 'state_rejected',
  containing: 'state_containing',
  contained: 'state_contained',
  failed: 'state_failed',
  closed: 'state_closed',
};
const linearConfig = {
  RUNTIME_MODE: 'staging',
  ...stagingIpinfoEnvironment,
  LINEAR_PROVIDER_ENABLED: 'true',
  LINEAR_API_KEY: 'fake-linear-api-key',
  LINEAR_WORKSPACE_ID: 'workspace_1',
  LINEAR_TEAM_ID: 'team_1',
  LINEAR_SEVERITY_LABEL_IDS_JSON: JSON.stringify({
    low: 'label_low',
    medium: 'label_medium',
    high: 'label_high',
    critical: 'label_critical',
  }),
  LINEAR_STATUS_STATE_IDS_JSON: JSON.stringify(statusStateIds),
  LINEAR_INTERNAL_BASE_URL: 'https://incidents.example.test/base',
} as const;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.doUnmock('@mastra/core/mastra');
  vi.doUnmock('@mastra/libsql');
});

describe('WorkOS identity evidence boundary', () => {
  const evidenceInput = {
    tenantId: 'tenant_1',
    incidentId: 'incident_1',
    subjectId: 'user_1',
    workflowRunId: 'run_1',
    incidentKind: 'unknown_device_login' as const,
    occurredAt: '2026-08-29T00:00:00.000Z',
    sessionId: 'session_1',
  };

  it('projects real-via-fake WorkOS reads without selecting mock facts', async () => {
    const provider = new WorkOsIdentityEvidenceProvider(
      new WorkOsIdentityProvider({
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
            getUser: async () => ({ id: 'user_1' }),
            listSessions: async () => ({
              data: [
                {
                  id: 'session_1',
                  userId: 'user_1',
                  organizationId: 'tenant_1',
                  status: 'active',
                },
              ],
            }),
            revokeSession: async () => ({}),
          },
          organizations: {
            getMembership: async () => ({}),
            updateMembership: async () => ({}),
          },
        },
        organizationId: 'tenant_1',
        allowedUserIds: new Set(['user_1']),
        allowedRoleSlugs: new Set(['member', 'admin']),
      }),
    );
    await expect(
      provider.inspect(evidenceInput, {
        signal: new AbortController().signal,
        attempt: 1,
      }),
    ).resolves.toMatchObject({
      status: 'success',
      provider: 'workos-identity',
      facts: expect.arrayContaining([
        expect.objectContaining({ semanticKey: 'identity.user.status' }),
        expect.objectContaining({ semanticKey: 'identity.session.status' }),
      ]),
    });
  });

  it('returns an explicit disabled state instead of mock evidence', async () => {
    await expect(
      new DisabledIdentityEvidenceProvider().inspect(evidenceInput, {
        signal: new AbortController().signal,
        attempt: 1,
      }),
    ).resolves.toMatchObject({
      status: 'operational_error',
      provider: 'disabled-identity',
    });
  });

  it('collects the IPinfo facts even when the WorkOS evidence boundary is disabled', async () => {
    const provider = new GeoIpIdentityEvidenceProvider({
      base: new DisabledIdentityEvidenceProvider(),
      geoip: new IpinfoLiteProvider({
        token: 'fake',
        timeoutMs: 100,
        transport: async () => ({
          status: 200,
          json: async () => ({ country_code: 'CA' }),
        }),
      }),
      timeoutMs: 100,
    });
    await expect(
      provider.inspect(
        {
          ...evidenceInput,
          incidentKind: 'disallowed_country_login',
          ip: '8.8.8.8',
        },
        { signal: new AbortController().signal, attempt: 1 },
      ),
    ).resolves.toMatchObject({
      status: 'success',
      provider: 'identity-geoip',
      facts: expect.arrayContaining([
        expect.objectContaining({ factType: 'login.ipPresent', value: true }),
        expect.objectContaining({
          factType: 'login.country',
          value: 'CA',
          confidenceProvenance: 'policy-v1',
        }),
      ]),
    });
  });
});

describe('external provider configuration', () => {
  it('keeps local mode self-contained by default', () => {
    const config = readIntegrationConfig(base);
    expect(config.workos.enabled).toBe(false);
    expect(config.ipinfo.enabled).toBe(false);
    expect(config.linear.enabled).toBe(false);
  });

  it('supports production and fails closed for incomplete or placeholder credentials', () => {
    expect(readIntegrationConfig({ RUNTIME_MODE: 'production' }).mode).toBe('production');
    expect(readIntegrationConfig({ RUNTIME_MODE: 'staging' }).ipinfo.enabled).toBe(false);
    expect(() =>
      readIntegrationConfig({
        RUNTIME_MODE: 'staging',
        IPINFO_PROVIDER_ENABLED: 'true',
      }),
    ).toThrow('IPinfo provider configuration is incomplete.');
  });

  it('requires explicit, paired GeoIP HMAC key versions during rotation', () => {
    const ipinfo = {
      RUNTIME_MODE: 'staging',
      IPINFO_PROVIDER_ENABLED: 'true',
      IPINFO_TOKEN: 'fake-ipinfo-token',
      GEOIP_CACHE_HMAC_KEY: 'base64:AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
      GEOIP_CACHE_HMAC_KEY_VERSION: 'hmac-sha256-v2',
    };
    expect(readIntegrationConfig(ipinfo).ipinfo).toMatchObject({
      cacheHmacKeyVersion: 'hmac-sha256-v2',
    });
    expect(() =>
      readIntegrationConfig({
        ...ipinfo,
        GEOIP_CACHE_HMAC_KEY_VERSION: '',
      }),
    ).toThrow('IPinfo provider configuration is incomplete.');
    expect(() =>
      readIntegrationConfig({
        ...ipinfo,
        GEOIP_CACHE_HMAC_PREVIOUS_KEY: 'base64:AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=',
      }),
    ).toThrow('IPinfo provider configuration is incomplete.');
    expect(() =>
      readIntegrationConfig({
        ...ipinfo,
        GEOIP_CACHE_HMAC_PREVIOUS_KEY_VERSION: 'hmac-sha256-v1',
      }),
    ).toThrow('IPinfo provider configuration is incomplete.');
    expect(() =>
      readIntegrationConfig({
        ...ipinfo,
        GEOIP_CACHE_HMAC_PREVIOUS_KEY: 'base64:AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=',
        GEOIP_CACHE_HMAC_PREVIOUS_KEY_VERSION: 'hmac-sha256-v2',
      }),
    ).toThrow('IPinfo provider configuration is incomplete.');
  });

  it('accepts the 14-character token format issued by IPinfo', () => {
    const config = readIntegrationConfig({
      RUNTIME_MODE: 'staging',
      IPINFO_PROVIDER_ENABLED: 'true',
      IPINFO_TOKEN: 'abcd1234efgh56',
      GEOIP_CACHE_HMAC_KEY: 'base64:AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
      GEOIP_CACHE_HMAC_KEY_VERSION: 'hmac-sha256-v1',
    });

    expect(config.ipinfo).toMatchObject({
      enabled: true,
      token: 'abcd1234efgh56',
    });
  });

  it('validates WorkOS allowlists and the complete Linear map', () => {
    const workos = {
      RUNTIME_MODE: 'staging',
      ...stagingIpinfoEnvironment,
      WORKOS_PROVIDER_ENABLED: 'true',
      WEBHOOKS_ENABLED: 'true',
      WORKOS_API_KEY: 'workos-test-key-1',
      WORKOS_WEBHOOK_SECRET: 'webhook-test-key-1',
      WORKOS_ORGANIZATION_ID: 'tenant_1',
      WORKOS_ALLOWED_USER_IDS: 'user_1,user_2',
      WORKOS_ALLOWED_ROLE_SLUGS: 'member,admin',
    };
    for (const value of [undefined, '', '   ']) {
      expect(readIntegrationConfig({ ...workos, WORKOS_ALLOWED_USER_IDS: value }).workos.allowedUserIds.size).toBe(0);
    }
    expect(readIntegrationConfig(workos).workos.allowedUserIds).toEqual(new Set(['user_1', 'user_2']));
    expect(() =>
      readIntegrationConfig({
        ...workos,
        WORKOS_ALLOWED_USER_IDS: 'user_1,user_1',
      }),
    ).toThrow('Invalid WORKOS_ALLOWED_USER_IDS.');
    expect(() =>
      readIntegrationConfig({
        ...workos,
        WORKOS_WEBHOOK_PREVIOUS_SECRET: workos.WORKOS_WEBHOOK_SECRET,
      }),
    ).toThrow('WorkOS provider configuration is incomplete.');
    expect(() =>
      readIntegrationConfig({
        ...workos,
        WEBHOOKS_ENABLED: 'false',
      }),
    ).toThrow('WorkOS provider configuration is incomplete. Missing or invalid: WEBHOOKS_ENABLED=true.');
    expect(readIntegrationConfig(linearConfig).linear.statusStateIds).toEqual(statusStateIds);
    expect(() =>
      readIntegrationConfig({
        ...linearConfig,
        LINEAR_STATUS_STATE_IDS_JSON: JSON.stringify({
          awaiting_approval: 'state_awaiting_approval',
        }),
      }),
    ).toThrow('Invalid LINEAR_STATUS_STATE_IDS_JSON.');
  });
});

describe('WorkOS identity boundary', () => {
  it('projects unknown official session statuses conservatively and rejects inactive memberships', async () => {
    const provider = new WorkOsIdentityProvider({
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
          getUser: async () => ({ id: 'user_1' }),
          listSessions: async () => ({
            data: [
              {
                id: 'session_1',
                userId: 'user_1',
                organizationId: 'tenant_1',
                status: 'mystery',
              },
            ],
          }),
          revokeSession: async () => ({}),
        },
        organizations: {
          getMembership: async () => ({
            id: 'membership_1',
            userId: 'user_1',
            organizationId: 'tenant_1',
            role: { slug: 'admin' },
            status: 'inactive',
          }),
          updateMembership: async () => ({}),
        },
      },
      organizationId: 'tenant_1',
      allowedUserIds: new Set(['user_1']),
      allowedRoleSlugs: new Set(['admin', 'member']),
      authorizeMutation: () => true,
    });
    await expect(provider.listSessions({ tenantId: 'tenant_1', userId: 'user_1' })).resolves.toContainEqual(
      expect.objectContaining({ status: 'unknown' }),
    );
    await expect(
      provider.restoreRole({
        tenantId: 'tenant_1',
        userId: 'user_1',
        membershipId: 'membership_1',
        expectedCurrentRole: 'admin',
        previousRole: 'member',
        approvalContext: integrationApprovalContext,
      }),
    ).rejects.toThrow();
  });

  it('binds snapshot integrity to authoritative scope, reference, source, version, and content', () => {
    const input = {
      tenantId: 'tenant_1',
      incidentId: 'incident_1',
      subjectId: 'user_1',
      sourceEventId: 'event_1',
      snapshot: { currentRole: 'admin', membershipId: 'membership_1' },
      snapshotRef: 'protected://snapshots/1',
      schemaVersion: 1,
    };
    const hash = identitySnapshotIntegrityHash(input);
    expect(
      identitySnapshotIntegrityHash({
        ...input,
        snapshot: { membershipId: 'membership_1', currentRole: 'admin' },
      }),
    ).toBe(hash);
    expect(identitySnapshotIntegrityHash({ ...input, sourceEventId: 'event_2' })).not.toBe(hash);
    expect(identitySnapshotIntegrityHash({ ...input, incidentId: 'incident_2' })).not.toBe(hash);
  });

  it('uses only the injected client and enforces tenant, allowlist, CAS, and post-verification', async () => {
    const calls: string[] = [];
    let membershipRole = 'admin';
    let sessionStatus: 'active' | 'revoked' = 'active';
    const client = {
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
        getUser: async (userId: string) => {
          calls.push(`getUser:${userId}`);
          return {
            id: userId,
            status: 'active',
            email: 'not-projected@example.test',
          };
        },
        listSessions: async ({ userId }: { userId: string }) => {
          calls.push(`listSessions:${userId}`);
          return {
            data: [
              {
                id: 'session_1',
                userId,
                organizationId: 'tenant_1',
                status: sessionStatus,
              },
            ],
          };
        },
        revokeSession: async (sessionId: string) => {
          calls.push(`revokeSession:${sessionId}`);
          sessionStatus = 'revoked';
          return { id: sessionId, userId: 'user_1', status: 'revoked' };
        },
      },
      organizations: {
        getMembership: async (membershipId: string) => {
          calls.push(`getMembership:${membershipId}`);
          return {
            id: membershipId,
            userId: 'user_1',
            organizationId: 'tenant_1',
            roleSlug: membershipRole,
            status: 'active',
          };
        },
        updateMembership: async (membershipId: string, input: { roleSlug: string }) => {
          calls.push(`updateMembership:${membershipId}:${input.roleSlug}`);
          membershipRole = input.roleSlug;
          return {
            id: membershipId,
            userId: 'user_1',
            organizationId: 'tenant_1',
            roleSlug: input.roleSlug,
            status: 'active',
          };
        },
      },
    };
    const provider = new WorkOsIdentityProvider({
      client,
      organizationId: 'tenant_1',
      allowedUserIds: new Set(['user_1']),
      allowedRoleSlugs: new Set(['member', 'admin']),
      authorizeMutation: () => true,
    });

    await expect(provider.getUser({ tenantId: 'tenant_1', userId: 'user_1' })).resolves.toEqual({
      id: 'user_1',
      tenantId: 'tenant_1',
      status: 'active',
    });
    await expect(
      provider.revokeSession({
        tenantId: 'tenant_1',
        userId: 'user_1',
        sessionId: 'session_1',
        approvalContext: integrationApprovalContext,
      }),
    ).resolves.toMatchObject({ id: 'session_1', status: 'revoked' });
    await expect(
      provider.restoreRole({
        tenantId: 'tenant_1',
        userId: 'user_1',
        membershipId: 'membership_1',
        expectedCurrentRole: 'admin',
        previousRole: 'member',
        approvalContext: integrationApprovalContext,
      }),
    ).resolves.toMatchObject({ id: 'membership_1', roleSlug: 'member' });
    expect(calls).toEqual([
      'getUser:user_1',
      'listSessions:user_1',
      'revokeSession:session_1',
      'listSessions:user_1',
      'getMembership:membership_1',
      'updateMembership:membership_1:member',
      'getMembership:membership_1',
    ]);
    await expect(provider.getUser({ tenantId: 'tenant_other', userId: 'user_1' })).rejects.toThrow();
    expect(calls).toHaveLength(7);
  });

  it('rejects expired approval before a mock or WorkOS mutation', async () => {
    const mock = new LocalIdentityProvider({
      users: [
        {
          id: 'user_1',
          tenantId: 'tenant_1',
          status: 'active',
        },
      ],
      sessions: [
        {
          id: 'session_1',
          userId: 'user_1',
          status: 'active',
        },
      ],
      memberships: [],
    });
    await expect(
      mock.revokeSession({
        tenantId: 'tenant_1',
        userId: 'user_1',
        sessionId: 'session_1',
        approvalContext: {
          ...integrationApprovalContext,
          deadline: '2020-01-01T00:00:00.000Z',
        },
      }),
    ).rejects.toThrow();
    const revokeSession = vi.fn();
    const workos = new WorkOsIdentityProvider({
      client: {
        userManagement: {
          listOrganizationMemberships: async ({
            userId,
            organizationId,
          }: {
            userId: string;
            organizationId: string;
          }) => ({
            data: [
              {
                userId,
                organizationId,
                status: 'active',
              },
            ],
          }),
          getUser: async () => ({ id: 'user_1', status: 'active' }),
          listSessions: async () => ({
            data: [
              {
                id: 'session_1',
                userId: 'user_1',
                organizationId: 'tenant_1',
                status: 'active',
              },
            ],
          }),
          revokeSession,
        },
        organizations: {
          getMembership: async () => ({}),
          updateMembership: async () => ({}),
        },
      },
      organizationId: 'tenant_1',
      allowedUserIds: new Set(['user_1']),
      allowedRoleSlugs: new Set(['member']),
    });
    await expect(
      workos.revokeSession({
        tenantId: 'tenant_1',
        userId: 'user_1',
        sessionId: 'session_1',
        approvalContext: {
          ...integrationApprovalContext,
          deadline: '2020-01-01T00:00:00.000Z',
        },
      }),
    ).rejects.toThrow();
    expect(revokeSession).not.toHaveBeenCalled();
  });

  it('rejects a membership from another organization before a WorkOS mutation', async () => {
    const updateMembership = vi.fn();
    const provider = new WorkOsIdentityProvider({
      client: {
        userManagement: {
          listOrganizationMemberships: async ({
            userId,
            organizationId,
          }: {
            userId: string;
            organizationId: string;
          }) => ({
            data: [
              {
                userId,
                organizationId,
                status: 'active',
              },
            ],
          }),
          getUser: async () => ({ id: 'user_1', status: 'active' }),
          listSessions: async () => ({ data: [] }),
          revokeSession: async () => ({}),
        },
        organizations: {
          getMembership: async () => ({
            id: 'membership_1',
            userId: 'user_1',
            organizationId: 'tenant_other',
            roleSlug: 'admin',
          }),
          updateMembership,
        },
      },
      organizationId: 'tenant_1',
      allowedUserIds: new Set(['user_1']),
      allowedRoleSlugs: new Set(['member', 'admin']),
      authorizeMutation: () => true,
    });
    await expect(
      provider.restoreRole({
        tenantId: 'tenant_1',
        userId: 'user_1',
        membershipId: 'membership_1',
        expectedCurrentRole: 'admin',
        previousRole: 'member',
        approvalContext: integrationApprovalContext,
      }),
    ).rejects.toThrow();
    expect(updateMembership).not.toHaveBeenCalled();
  });

  it('fails closed when a caller fabricates approval fields without the gateway capability', async () => {
    const revokeSession = vi.fn();
    const provider = new WorkOsIdentityProvider({
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
          getUser: async () => ({ id: 'user_1', status: 'active' }),
          listSessions: async () => ({
            data: [
              {
                id: 'session_1',
                userId: 'user_1',
                organizationId: 'tenant_1',
                status: 'active',
              },
            ],
          }),
          revokeSession,
        },
        organizations: {
          getMembership: async () => ({}),
          updateMembership: async () => ({}),
        },
      },
      organizationId: 'tenant_1',
      allowedUserIds: new Set(['user_1']),
      allowedRoleSlugs: new Set(['member']),
    });
    await expect(
      provider.revokeSession({
        tenantId: 'tenant_1',
        userId: 'user_1',
        sessionId: 'session_1',
        approvalContext: integrationApprovalContext,
      }),
    ).rejects.toThrow();
    expect(revokeSession).not.toHaveBeenCalled();
  });
});

describe('IPinfo Lite boundary', () => {
  it('minimizes known responses, sends Bearer only in a header, and caches successes', async () => {
    let calls = 0;
    const requests: Array<{ url: string; headers: Record<string, string> }> = [];
    const provider = new IpinfoLiteProvider({
      token: 'test-token',
      timeoutMs: 1_500,
      now: () => new Date('2026-08-29T00:00:00.000Z'),
      transport: async request => {
        calls += 1;
        requests.push({ url: request.url, headers: { ...request.headers } });
        return {
          status: 200,
          json: async () => ({
            country_code: 'US',
            asn: 'AS15169',
            as_name: 'Google LLC',
            forbidden: 'not-projected',
          }),
        };
      },
    });
    const input = {
      ip: integrationPublicIps.googleDns,
      deadline: new Date('2026-08-29T00:00:01.000Z'),
    };
    const result = await provider.lookup(input);
    expect(result).toMatchObject({
      outcome: 'known',
      countryCode: 'US',
      asn: 'AS15169',
      provider: 'ipinfo-lite',
      confidence: 0.7,
      confidenceProvenance: 'policy-v1',
    });
    expect(JSON.stringify(result)).not.toContain('forbidden');
    await provider.lookup(input);
    expect(calls).toBe(1);
    expect(requests[0]).toEqual({
      url: 'https://api.ipinfo.io/lite/8.8.8.8',
      headers: {
        Authorization: 'Bearer test-token',
        Accept: 'application/json',
      },
    });
  });

  it('does not call the transport for private/bogon inputs or malformed addresses', async () => {
    const transport = vi.fn();
    const provider = new IpinfoLiteProvider({
      token: 'test-token',
      timeoutMs: 1_500,
      transport,
    });
    await expect(
      provider.lookup({
        ip: '10.0.0.1',
        deadline: new Date(Date.now() + 1_000),
      }),
    ).resolves.toEqual({ outcome: 'unknown', reasonCode: 'private' });
    await expect(
      provider.lookup({
        ip: integrationPublicIps.bogon,
        deadline: new Date(Date.now() + 1_000),
      }),
    ).resolves.toEqual({ outcome: 'unknown', reasonCode: 'bogon' });
    await expect(
      provider.lookup({
        ip: '999.999.999.999',
        deadline: new Date(Date.now() + 1_000),
      }),
    ).rejects.toThrow('Invalid IP address.');
    expect(transport).not.toHaveBeenCalled();
  });

  it('does not disclose special-purpose IPv4 or IPv6 addresses to IPinfo', async () => {
    const transport = vi.fn();
    const provider = new IpinfoLiteProvider({
      token: 'test-token',
      timeoutMs: 1_500,
      transport,
    });
    for (const ip of ['100.64.0.1', '192.0.2.1', '198.51.100.1', '203.0.113.1', '::', 'ff00::1']) {
      await expect(provider.lookup({ ip, deadline: new Date(Date.now() + 1_000) })).resolves.toMatchObject({
        outcome: 'unknown',
      });
    }
    expect(transport).not.toHaveBeenCalled();
  });

  it('does not cache failures and expires a positive cache entry', async () => {
    let now = new Date('2026-08-29T00:00:00.000Z');
    let calls = 0;
    const provider = new IpinfoLiteProvider({
      token: 'test-token',
      timeoutMs: 1_500,
      cacheTtlMs: 100,
      now: () => now,
      transport: async () => {
        calls += 1;
        if (calls === 1) return { status: 500, json: async () => ({}) };
        return { status: 200, json: async () => ({ country: 'BR' }) };
      },
    });
    const input = {
      ip: integrationPublicIps.ipv6,
      deadline: new Date('2026-08-29T00:00:10.000Z'),
    };
    await expect(provider.lookup(input)).resolves.toEqual({
      outcome: 'unknown',
      reasonCode: 'unavailable',
    });
    await expect(provider.lookup(input)).resolves.toMatchObject({
      outcome: 'known',
      countryCode: 'BR',
    });
    now = new Date(now.getTime() + 101);
    await provider.lookup(input);
    expect(calls).toBe(3);
  });

  it('returns stable unknown outcomes for cancellation, quota, and invalid responses', async () => {
    const aborted = new AbortController();
    aborted.abort();
    const cancelledTransport = vi.fn();
    const cancelled = new IpinfoLiteProvider({
      token: 'test-token',
      timeoutMs: 1_500,
      transport: cancelledTransport,
    });
    await expect(
      cancelled.lookup({
        ip: integrationPublicIps.ipv4,
        deadline: new Date(Date.now() + 1_000),
        signal: aborted.signal,
      }),
    ).resolves.toEqual({ outcome: 'unknown', reasonCode: 'timeout' });
    expect(cancelledTransport).not.toHaveBeenCalled();
    const rateLimited = new IpinfoLiteProvider({
      token: 'test-token',
      timeoutMs: 1_500,
      transport: async () => ({ status: 429, json: async () => ({}) }),
    });
    await expect(
      rateLimited.lookup({
        ip: integrationPublicIps.ipv4,
        deadline: new Date(Date.now() + 1_000),
      }),
    ).resolves.toEqual({ outcome: 'unknown', reasonCode: 'rate_limited' });
    const invalid = new IpinfoLiteProvider({
      token: 'test-token',
      timeoutMs: 1_500,
      transport: async () => ({
        status: 200,
        json: async () => ({ country_code: 'BRA' }),
      }),
    });
    await expect(
      invalid.lookup({
        ip: integrationPublicIps.ipv4,
        deadline: new Date(Date.now() + 1_000),
      }),
    ).resolves.toEqual({ outcome: 'unknown', reasonCode: 'invalid_response' });
    const bogon = new IpinfoLiteProvider({
      token: 'test-token',
      timeoutMs: 1_500,
      transport: async () => ({
        status: 200,
        json: async () => ({ bogon: true }),
      }),
    });
    await expect(
      bogon.lookup({
        ip: integrationPublicIps.ipv4,
        deadline: new Date(Date.now() + 1_000),
      }),
    ).resolves.toEqual({ outcome: 'unknown', reasonCode: 'bogon' });
  });
});

describe('Linear boundary', () => {
  it('does not silently select the mock incident provider in staging', async () => {
    const provider = createIncidentProvider(
      readIntegrationConfig({
        RUNTIME_MODE: 'staging',
        ...stagingIpinfoEnvironment,
      }),
    );
    expect(provider.providerId).toBe('disabled');
    await expect(
      provider.create({
        idempotencyKey: 'disabled-provider',
        generation: 1,
        projection: {
          incidentId: 'incident_1',
          tenantId: 'tenant_1',
          kind: 'unknown_device_login',
          severity: 'high',
          status: 'awaiting_approval',
          occurredAt: '2026-08-29T00:00:00.000Z',
          summaryCode: 'UNKNOWN_DEVICE_REQUIRES_REVIEW',
          planHashVersion: 1,
          planHash: 'a'.repeat(64),
          actionTypes: ['revoke_session'],
        },
      }),
    ).rejects.toThrow();
  });

  it('projects only allowlisted incident fields to Linear and verifies updates', async () => {
    const calls: unknown[] = [];
    let remoteTitle = '';
    const client: LinearIssueClient = {
      createIssue: async input => {
        calls.push(input);
        remoteTitle = input.title;
        return { success: true, issueId: 'linear_issue_1' };
      },
      updateIssue: async (id, input) => {
        calls.push({ id, ...input });
        remoteTitle = input.title;
        return { success: true, issueId: id };
      },
      searchIssues: async () => ({ nodes: [] }),
      issue: async id => ({
        id,
        title: remoteTitle,
        state: { id: 'state_1' },
        team: { id: 'team_1' },
      }),
    };
    const provider = new LinearIncidentProvider({
      client,
      workspaceId: 'workspace_1',
      teamId: 'team_1',
      severityLabelIds: { low: 'l', medium: 'm', high: 'h', critical: 'c' },
      statusStateIds: { awaiting_approval: 'state_1' },
      internalBaseUrl: 'https://incidents.example.test/base',
      resolveDestination: async () => ({
        workspaceId: 'workspace_1',
        teamId: 'team_1',
      }),
    });
    const projection = {
      incidentId: 'incident_1',
      tenantId: 'tenant_1',
      kind: 'unknown_device_login' as const,
      severity: 'high' as const,
      status: 'awaiting_approval' as const,
      occurredAt: '2026-08-29T00:00:00.000Z',
      summaryCode: 'UNKNOWN_DEVICE_REQUIRES_REVIEW' as const,
      planHashVersion: 1 as const,
      planHash: 'a'.repeat(64),
      actionTypes: ['revoke_session' as const],
    };
    await expect(
      provider.create({
        idempotencyKey: 'local-ledger-only',
        generation: 1,
        projection,
      }),
    ).resolves.toEqual({ externalRef: 'linear:linear_issue_1' });
    await expect(
      provider.update({
        externalRef: 'linear:linear_issue_1',
        idempotencyKey: 'local-ledger-only',
        generation: 2,
        projection,
      }),
    ).resolves.toEqual({ externalRef: 'linear:linear_issue_1' });
    expect(JSON.stringify(calls)).not.toContain('tenant_1');
    expect(JSON.stringify(calls)).not.toContain('aaaaaaaa');
    expect(JSON.stringify(calls)).not.toContain('local-ledger-only');
    await expect(
      provider.update({
        externalRef: 'https://evil.test',
        idempotencyKey: 'key',
        generation: 1,
        projection,
      }),
    ).rejects.toThrow();
  });

  it('reconciles a Linear create whose response is lost before retrying', async () => {
    let searches = 0;
    let marker = '';
    const provider = new LinearIncidentProvider({
      client: {
        createIssue: async () => {
          throw new Error('response lost');
        },
        updateIssue: async () => ({ success: false }),
        searchIssues: async term => {
          marker = term;
          return {
            nodes: searches++ === 0 ? [] : [{ id: 'issue_recovered' }],
          };
        },
        issue: async id => ({
          id,
          title: marker,
          state: { id: 'state_1' },
          team: { id: 'team_1' },
        }),
      },
      workspaceId: 'workspace_1',
      teamId: 'team_1',
      severityLabelIds: { low: 'l', medium: 'm', high: 'h', critical: 'c' },
      statusStateIds: { awaiting_approval: 'state_1' },
      internalBaseUrl: 'https://incidents.example.test',
      resolveDestination: async () => ({
        workspaceId: 'workspace_1',
        teamId: 'team_1',
      }),
    });
    await expect(
      provider.create({
        idempotencyKey: 'local-ledger-only',
        generation: 1,
        projection: {
          incidentId: 'incident_1',
          tenantId: 'tenant_1',
          kind: 'unknown_device_login',
          severity: 'high',
          status: 'awaiting_approval',
          occurredAt: '2026-08-29T00:00:00.000Z',
          summaryCode: 'UNKNOWN_DEVICE_REQUIRES_REVIEW',
          planHashVersion: 1,
          planHash: 'a'.repeat(64),
          actionTypes: ['revoke_session'],
        },
      }),
    ).resolves.toEqual({ externalRef: 'linear:issue_recovered' });
    expect(searches).toBe(2);
  });

  it('fails closed before a Linear write when the approved workspace binding differs', async () => {
    let creates = 0;
    const provider = new LinearIncidentProvider({
      client: {
        createIssue: async () => {
          creates += 1;
          return { success: true, issue: { id: 'must_not_write' } };
        },
        updateIssue: async () => ({ success: false }),
        searchIssues: async () => ({ nodes: [] }),
      },
      workspaceId: 'workspace_approved',
      teamId: 'team_approved',
      projectId: 'project_approved',
      severityLabelIds: { low: 'l', medium: 'm', high: 'h', critical: 'c' },
      statusStateIds: { awaiting_approval: 'state_1' },
      internalBaseUrl: 'https://incidents.example.test/security',
      resolveDestination: async () => ({
        workspaceId: 'workspace_other',
        teamId: 'team_approved',
        projectId: 'project_approved',
      }),
    });
    await expect(
      provider.create({
        idempotencyKey: 'destination-binding',
        generation: 1,
        projection: {
          incidentId: 'incident_1',
          tenantId: 'tenant_1',
          kind: 'unknown_device_login',
          severity: 'high',
          status: 'awaiting_approval',
          occurredAt: '2026-08-29T00:00:00.000Z',
          summaryCode: 'UNKNOWN_DEVICE_REQUIRES_REVIEW',
          planHashVersion: 1,
          planHash: 'a'.repeat(64),
          actionTypes: ['revoke_session'],
        },
      }),
    ).rejects.toThrow();
    expect(creates).toBe(0);
  });

  it('keeps staging domain events local and isolated from Mastra orchestration', async () => {
    let mastraOptions: Record<string, unknown> | undefined;
    const storageDatabase = await createTempDatabase();
    let storage: Readonly<{ close(): Promise<void> }> | undefined;
    let domainEvents: Readonly<{ close(): Promise<void> }> | undefined;
    vi.doMock('@mastra/core/mastra', () => ({
      Mastra: class {
        constructor(options: Record<string, unknown>) {
          mastraOptions = options;
        }
      },
    }));
    vi.stubEnv('RUNTIME_MODE', 'staging');
    vi.stubEnv('APPROVAL_RESUME_SECRET', 'r'.repeat(32));
    vi.stubEnv('WORKOS_PROVIDER_ENABLED', 'false');
    for (const [name, value] of Object.entries(stagingIpinfoEnvironment)) vi.stubEnv(name, value);
    vi.stubEnv('LINEAR_PROVIDER_ENABLED', 'false');
    vi.stubEnv('MASTRA_STORAGE_URL', storageDatabase.url);
    try {
      const { InProcessDomainPubSub } = await import('../../src/workers/in-process-domain-pubsub.js');
      const runtimeModule = await import('../../src/mastra/runtime.js');
      const runtime = runtimeModule.createRuntimeMastra(readAgentConfig());
      storage = runtimeModule.storage;
      expect(mastraOptions?.pubsub).toBeUndefined();
      expect(mastraOptions?.server).toBeUndefined();
      domainEvents = runtimeModule.createDomainEventPubSub();
      expect(domainEvents).toBeInstanceOf(InProcessDomainPubSub);
      expect(domainEvents).not.toBe(runtime.pubsub);
    } finally {
      await domainEvents?.close();
      await storage?.close();
      await storageDatabase.cleanup();
    }
  });

  it('isolates local domain events in a dedicated in-process PubSub', async () => {
    const storageDatabase = await createTempDatabase();
    let storage: Readonly<{ close(): Promise<void> }> | undefined;
    let domainEvents: Readonly<{ close(): Promise<void> }> | undefined;
    vi.stubEnv('RUNTIME_MODE', 'local');
    vi.stubEnv('WORKOS_PROVIDER_ENABLED', 'false');
    vi.stubEnv('IPINFO_PROVIDER_ENABLED', 'false');
    vi.stubEnv('LINEAR_PROVIDER_ENABLED', 'false');
    vi.stubEnv('MASTRA_STORAGE_URL', storageDatabase.url);
    try {
      const { InProcessDomainPubSub } = await import('../../src/workers/in-process-domain-pubsub.js');
      const runtimeModule = await import('../../src/mastra/index.js');
      storage = runtimeModule.storage;
      domainEvents = runtimeModule.createDomainEventPubSub();

      expect(domainEvents).toBeInstanceOf(InProcessDomainPubSub);
      expect(domainEvents).not.toBe(runtimeModule.mastra.pubsub);
    } finally {
      await domainEvents?.close();
      await storage?.close();
      await storageDatabase.cleanup();
    }
  });
});
