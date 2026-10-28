import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { AlertWebhookSchema } from '../../src/app/webhooks/schemas.js';
import { SecurityIncidentWorkflowInputSchema } from '../../src/mastra/workflows/security-incident-workflow.js';
import { materializeLocalFixture, sendLocalFixture } from '../../scripts/local-fixture-alert.js';
import { triggerScenario } from '../../scripts/scenario-trigger.js';
import {
  createWorkOsStagingActionClient,
  type WorkOsStagingActionClient,
} from '../../scripts/workos-staging-actions.js';
import { verifyWebhookSignature } from '../../src/app/webhooks/signature.js';
import { stagingIpinfoEnvironment } from '../fixtures/integrations.js';

const fixedNow = Date.parse('2026-09-01T15:00:00.000Z');

describe('local fixture alert scripts', () => {
  it.each([
    ['privilege', 'unauthorized-privilege-change.json'],
    ['country', 'disallowed-country-login.json'],
    ['device', 'unknown-device-login.json'],
  ] as const)('keeps the %s Studio fixture identical to the Hono alert contract', async (_, filename) => {
    const fixture = JSON.parse(await readFile(new URL(`../../scripts/fixtures/${filename}`, import.meta.url), 'utf8'));

    expect(() => AlertWebhookSchema.parse(fixture)).not.toThrow();
    expect(() => SecurityIncidentWorkflowInputSchema.parse(fixture)).not.toThrow();
  });

  it('also accepts the durable Hono/outbox reference and rejects mixed input', () => {
    const reference = {
      eventId: 'event-1',
      incidentId: 'incident-1',
      tenantId: 'tenant-1',
      alertId: 'alert-1',
      correlationId: 'correlation-1',
    };
    expect(SecurityIncidentWorkflowInputSchema.parse(reference)).toEqual(reference);
    expect(() =>
      SecurityIncidentWorkflowInputSchema.parse({
        ...reference,
        schemaVersion: 1,
      }),
    ).toThrow();
  });

  it.each([
    ['privilege', 'unauthorized_privilege_change'],
    ['country', 'disallowed_country_login'],
    ['device', 'unknown_device_login'],
  ] as const)('materializes %s with local overrides while preserving one generic contract', async (scenario, kind) => {
    const alert = await materializeLocalFixture(scenario, {
      environment: {
        RUNTIME_MODE: 'local',
        ALERT_WEBHOOK_SOURCE: 'reference-auth',
        INCIDENT_TENANT_ID: 'org_local',
        INCIDENT_SUBJECT_ID: 'user_local',
      },
      now: () => fixedNow,
      createId: () => '11111111-2222-4333-8444-555555555555',
    });

    expect(AlertWebhookSchema.parse(alert)).toMatchObject({
      kind,
      source: 'reference-auth',
      tenantId: 'org_local',
      subjectId: 'user_local',
      sourceEventId: expect.stringMatching(/-11111111222243338444555555555555$/u),
      occurredAt: '2026-09-01T15:00:00.000Z',
    });
  });

  it('generates sourceEventId and occurredAt instead of reusing fixture identity', async () => {
    await expect(
      materializeLocalFixture('country', {
        environment: { RUNTIME_MODE: 'local' },
        now: () => fixedNow,
        createId: () => '11111111-2222-4333-8444-555555555555',
      }),
    ).resolves.toMatchObject({
      sourceEventId: 'country-login-11111111222243338444555555555555',
      occurredAt: '2026-09-01T15:00:00.000Z',
    });
  });

  it('POSTs a current HMAC-signed payload to Hono and returns only the receipt', async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = String(init?.body);
      const signature = String((init?.headers as Record<string, string>)['X-Alert-Signature']);
      const expected = createHmac('sha256', 'reference-alert-secret')
        .update(`${fixedNow}.`, 'utf8')
        .update(body, 'utf8')
        .digest('hex');
      expect(signature).toBe(`t=${fixedNow},v1=${expected}`);
      expect(AlertWebhookSchema.parse(JSON.parse(body)).kind).toBe('disallowed_country_login');
      return new Response(JSON.stringify({ accepted: true, incidentId: 'incident_1' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await sendLocalFixture('country', {
      environment: {
        RUNTIME_MODE: 'local',
        ALERT_WEBHOOK_SECRET: 'reference-alert-secret',
        ALERT_WEBHOOK_URL: 'http://localhost:3000/webhooks/alerts',
        ALERT_WEBHOOK_SOURCE: 'reference-auth',
      },
      now: () => fixedNow,
      createId: () => '11111111-2222-4333-8444-555555555555',
      fetch,
    });

    expect(fetch).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      delivered: true,
      status: 202,
      response: { accepted: true, incidentId: 'incident_1' },
    });
    expect(result).not.toHaveProperty('alert');
    expect(JSON.stringify(result)).not.toContain('reference-alert-secret');
  });

  it('does not require or expose a signing secret in print-only mode', async () => {
    const fetch = vi.fn();
    const result = await sendLocalFixture('device', {
      environment: {
        RUNTIME_MODE: 'local',
        ALERT_WEBHOOK_SOURCE: 'reference-auth',
      },
      now: () => fixedNow,
      createId: () => '11111111-2222-4333-8444-555555555555',
      fetch,
      printOnly: true,
    });

    expect(result.delivered).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    if (result.delivered === false) {
      expect(AlertWebhookSchema.parse(result.alert).kind).toBe('unknown_device_login');
    }
  });

  it('refuses fixtures in staging before reading, signing, or delivering one', async () => {
    const fetch = vi.fn();
    await expect(
      sendLocalFixture('country', {
        environment: { RUNTIME_MODE: 'staging' },
        fetch,
      }),
    ).rejects.toThrow(/Local fixtures are disabled/u);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['privilege', 'organization_membership.updated'],
    ['country', 'session.created'],
  ] as const)('routes the staging %s scenario to a real WorkOS action', async (scenario, expectedEvent) => {
    const result = await triggerScenario(scenario, {
      environment: workOsStagingEnvironment(),
    });
    expect(result).toMatchObject({
      mode: 'staging',
      provider: 'workos',
      scenario,
      expectedEvent,
    });
  });

  it('explains the real WorkOS plus first-party device staging flow', async () => {
    await expect(
      triggerScenario('device', {
        environment: workOsStagingEnvironment(),
      }),
    ).resolves.toMatchObject({
      provider: 'workos+first-party-device-trust',
      expectedEvent: 'unknown_device_login',
    });
  });

  it('authenticates in WorkOS and emits a signed new-device proof without exposing secrets', async () => {
    const recordDeviceAttestation = vi.fn(async () => {});
    const sendDeviceAlert = vi.fn(async () => ({
      status: 202,
      response: { accepted: true },
    }));
    const result = await triggerScenario('device', {
      environment: workOsStagingEnvironment(),
      stagingAction: {
        kind: 'device-login',
        email: 'jane@doe.com',
        password: 'not-printed',
        newDevice: true,
        execute: true,
      },
      workosClient: workOsActionClient({
        authenticateWithPassword: async () => ({
          userId: 'user_staging',
          organizationId: 'org_staging',
          sessionId: 'session_staging',
        }),
        recordDeviceAttestation,
        sendDeviceAlert,
      }),
    });

    expect(recordDeviceAttestation).toHaveBeenCalledOnce();
    expect(sendDeviceAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'first-party-device-trust',
        kind: 'unknown_device_login',
        subjectId: 'user_staging',
        sessionId: 'session_staging',
      }),
    );
    expect(result).toMatchObject({
      action: 'device-login',
      deliveryStatus: 202,
      credentialsExposed: false,
      tokensExposed: false,
    });
    expect(JSON.stringify(result)).not.toContain('not-printed');
  });

  it("signs first-party device alerts with the receiver's millisecond timestamp contract", async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(fixedNow);
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const body = new TextEncoder().encode(String(init?.body));
      const header = String((init?.headers as Record<string, string>)['x-alert-signature']);
      expect(header).toMatch(/^t=\d{13},v1=[a-f0-9]{64}$/u);
      expect(() =>
        verifyWebhookSignature({
          header,
          secret: 'alert-webhook-secret-for-tests',
          rawBody: body,
          nowMs: fixedNow,
        }),
      ).not.toThrow();
      return new Response(JSON.stringify({ accepted: true }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    });
    try {
      const client = createWorkOsStagingActionClient(workOsStagingEnvironment());
      await expect(client.sendDeviceAlert?.({ kind: 'unknown_device_login' })).resolves.toMatchObject({ status: 202 });
    } finally {
      fetch.mockRestore();
      now.mockRestore();
    }
  });

  it('executes a real-via-fake WorkOS password login without exposing credentials or tokens', async () => {
    const authenticateWithPassword = vi.fn(async () => ({
      userId: 'user_staging',
      organizationId: 'org_staging',
    }));
    const result = await triggerScenario('country', {
      environment: workOsStagingEnvironment(),
      stagingAction: {
        kind: 'password-login',
        email: 'jane@doe.com',
        password: 'not-printed',
        ipAddress: '200.160.2.3',
        userAgent: 'staging-test-agent',
        execute: true,
      },
      workosClient: workOsActionClient({ authenticateWithPassword }),
    });

    expect(authenticateWithPassword).toHaveBeenCalledWith({
      email: 'jane@doe.com',
      password: 'not-printed',
      ipAddress: '200.160.2.3',
      userAgent: 'staging-test-agent',
    });
    expect(result).toMatchObject({
      action: 'password-login',
      expectedEvent: 'session.created',
      countryPolicy: {
        countryCode: 'BR',
        disposition: 'incident',
      },
      credentialsExposed: false,
      tokensExposed: false,
    });
    expect(JSON.stringify(result)).not.toContain('not-printed');
  });

  it('checks IPinfo before WorkOS and predicts a benign country closure', async () => {
    const calls: string[] = [];
    const authenticateWithPassword = vi.fn(async () => {
      calls.push('workos');
      return {
        userId: 'user_staging',
        organizationId: 'org_staging',
      };
    });
    const lookupCountry = vi.fn(async () => {
      calls.push('ipinfo');
      return {
        outcome: 'known' as const,
        countryCode: 'US',
        observedAt: '2026-09-01T15:00:00.000Z',
        provider: 'ipinfo-lite' as const,
        confidence: 0.7 as const,
        confidenceProvenance: 'policy-v1' as const,
      };
    });

    const result = await triggerScenario('country', {
      environment: workOsStagingEnvironment(),
      stagingAction: {
        kind: 'password-login',
        email: 'jane@doe.com',
        password: 'not-printed',
        ipAddress: '8.8.8.8',
        execute: true,
      },
      workosClient: workOsActionClient({
        authenticateWithPassword,
        lookupCountry,
      }),
    });

    expect(calls).toEqual(['ipinfo', 'workos']);
    expect(result).toMatchObject({
      countryPolicy: {
        countryCode: 'US',
        disposition: 'benign-closed',
      },
    });
  });

  it('does not create a WorkOS session when IPinfo cannot verify the IP', async () => {
    const authenticateWithPassword = vi.fn();
    await expect(
      triggerScenario('country', {
        environment: workOsStagingEnvironment(),
        stagingAction: {
          kind: 'password-login',
          email: 'jane@doe.com',
          password: 'not-printed',
          ipAddress: '8.8.8.8',
          execute: true,
        },
        workosClient: workOsActionClient({
          authenticateWithPassword,
          lookupCountry: async () => ({
            outcome: 'unknown',
            reasonCode: 'unavailable',
          }),
        }),
      }),
    ).rejects.toThrow(/IPinfo could not verify/u);
    expect(authenticateWithPassword).not.toHaveBeenCalled();
  });

  it('updates the WorkOS organization membership without a user allowlist through the official boundary', async () => {
    const calls: string[] = [];
    const stagePrivilegeChange = vi.fn(async () => {
      calls.push('intent');
      return {
        id: 'intent_staging',
        expiresAt: '2026-09-01T15:05:00.000Z',
      };
    });
    const updateMembershipRole = vi.fn(async () => {
      calls.push('workos');
      return {
        id: 'membership_staging',
        userId: 'user_staging',
        roleSlug: 'admin',
      };
    });
    const result = await triggerScenario('privilege', {
      environment: workOsStagingEnvironment(),
      stagingAction: {
        kind: 'membership-role-change',
        userId: 'user_staging',
        roleSlug: 'admin',
        actorId: 'staging-trigger',
        execute: true,
      },
      workosClient: workOsActionClient({
        stagePrivilegeChange,
        updateMembershipRole,
      }),
    });

    expect(stagePrivilegeChange).toHaveBeenCalledWith({
      tenantId: 'org_staging',
      userId: 'user_staging',
      membershipId: 'membership_staging',
      actorId: 'staging-trigger',
      previousRole: 'member',
      currentRole: 'admin',
    });
    expect(calls).toEqual(['intent', 'workos']);
    expect(updateMembershipRole).toHaveBeenCalledWith({
      membershipId: 'membership_staging',
      roleSlug: 'admin',
    });
    expect(result).toMatchObject({
      action: 'membership-role-change',
      previousRole: 'member',
      currentRole: 'admin',
      intentId: 'intent_staging',
      authorizationState: 'intentionally-unapproved',
      expectedEvent: 'organization_membership.updated',
    });
  });

  it.each([
    ['provider failure', new Error('provider unavailable')],
    [
      'unexpected provider response',
      {
        id: 'another_membership',
        userId: 'user_staging',
        roleSlug: 'admin',
      },
    ],
  ] as const)('expires the staging intent after %s', async (_, outcome) => {
    const expirePrivilegeChange = vi.fn(async () => {});
    const updateMembershipRole = vi.fn(async () => {
      if (outcome instanceof Error) throw outcome;
      return outcome;
    });

    await expect(
      triggerScenario('privilege', {
        environment: workOsStagingEnvironment(),
        stagingAction: {
          kind: 'membership-role-change',
          userId: 'user_staging',
          roleSlug: 'admin',
          actorId: 'staging-trigger',
          execute: true,
        },
        workosClient: workOsActionClient({
          updateMembershipRole,
          expirePrivilegeChange,
        }),
      }),
    ).rejects.toThrow();

    expect(expirePrivilegeChange).toHaveBeenCalledExactlyOnceWith('intent_staging');
  });

  it('requires explicit execution before a WorkOS staging mutation', async () => {
    await expect(
      triggerScenario('privilege', {
        environment: workOsStagingEnvironment(),
        stagingAction: {
          kind: 'membership-role-change',
          userId: 'user_staging',
          roleSlug: 'admin',
          actorId: 'staging-trigger',
          execute: false,
        },
        workosClient: workOsActionClient(),
      }),
    ).rejects.toThrow(/requires --execute/u);
  });

  it('rejects a demotion because the staging scenario models an elevation', async () => {
    await expect(
      triggerScenario('privilege', {
        environment: workOsStagingEnvironment(),
        stagingAction: {
          kind: 'membership-role-change',
          userId: 'user_staging',
          roleSlug: 'member',
          actorId: 'staging-trigger',
          execute: true,
        },
        workosClient: workOsActionClient(),
      }),
    ).rejects.toThrow(/requires --role=admin/u);
  });
});

function workOsStagingEnvironment(): NodeJS.ProcessEnv {
  return {
    RUNTIME_MODE: 'staging',
    ...stagingIpinfoEnvironment,
    WEBHOOKS_ENABLED: 'true',
    WORKOS_PROVIDER_ENABLED: 'true',
    DASHBOARD_AUTH_ENABLED: 'true',
    WORKOS_API_KEY: 'workos-api-key-for-tests',
    WORKOS_WEBHOOK_SECRET: 'workos-webhook-secret-for-tests',
    WORKOS_ORGANIZATION_ID: 'org_staging',
    WORKOS_ALLOWED_ROLE_SLUGS: 'member,admin',
    WORKOS_CLIENT_ID: 'client_staging',
    WORKOS_REDIRECT_URI: 'http://localhost:3000/auth/callback',
    DEVICE_TRUST_PROVIDER_ENABLED: 'true',
    DEVICE_TRUST_ALERT_SOURCE: 'first-party-device-trust',
    ALERT_WEBHOOK_SECRET: 'alert-webhook-secret-for-tests',
    ALERT_WEBHOOK_SOURCES: 'reference-app,first-party-device-trust',
  };
}

function workOsActionClient(overrides: Partial<WorkOsStagingActionClient> = {}): WorkOsStagingActionClient {
  return {
    findUsersByEmail: async () => [{ id: 'user_staging', email: 'jane@doe.com' }],
    authenticateWithPassword: async () => ({
      userId: 'user_staging',
      organizationId: 'org_staging',
    }),
    lookupCountry: async () => ({
      outcome: 'known',
      countryCode: 'BR',
      observedAt: '2026-09-01T15:00:00.000Z',
      provider: 'ipinfo-lite',
      confidence: 0.7,
      confidenceProvenance: 'policy-v1',
    }),
    listActiveMemberships: async () => [{ id: 'membership_staging', roleSlug: 'member' }],
    updateMembershipRole: async () => ({
      id: 'membership_staging',
      userId: 'user_staging',
      roleSlug: 'admin',
    }),
    stagePrivilegeChange: async () => ({
      id: 'intent_staging',
      expiresAt: '2026-09-01T15:05:00.000Z',
    }),
    expirePrivilegeChange: async () => {},
    ...overrides,
  };
}
