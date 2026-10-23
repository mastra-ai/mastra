import { createHmac, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';

import { WorkOS } from '@workos-inc/node';

import { readStorageConfig } from '../src/db/config.js';
import { createLibSqlOperationalStore } from '../src/db/libsql-operational-store.js';
import { migrateOperationalStore } from '../src/db/migrate.js';
import {
  expireStagingPrivilegeChange,
  stageUnauthorizedPrivilegeChange,
} from '../src/db/staging-privilege-intent-operations.js';
import { recordDeviceAttestation } from '../src/db/device-trust-operations.js';
import { readIntegrationConfig } from '../src/env.js';
import { createGeoIpProvider } from '../src/providers/runtime-factory.js';
import type { GeoIpLookupResult } from '../src/providers/geoip-contracts.js';
import { REFERENCE_ALLOWED_COUNTRY } from '../src/triage/policy-registry.js';
import { createEphemeralDeviceAttestation, type DeviceAttestationProof } from '../src/device-trust/attestation.js';

export type WorkOsStagingAction =
  | Readonly<{
      kind: 'password-login';
      email: string;
      password: string;
      ipAddress?: string;
      userAgent?: string;
      execute: boolean;
    }>
  | Readonly<{
      kind: 'membership-role-change';
      userId: string;
      roleSlug: string;
      actorId: string;
      execute: boolean;
    }>
  | Readonly<{
      kind: 'device-login';
      email: string;
      password: string;
      ipAddress?: string;
      userAgent?: string;
      newDevice: true;
      execute: boolean;
    }>;

export type WorkOsStagingActionClient = Readonly<{
  findUsersByEmail(email: string): Promise<readonly { id: string; email: string }[]>;
  authenticateWithPassword(
    input: Readonly<{
      email: string;
      password: string;
      ipAddress?: string;
      userAgent?: string;
    }>,
  ): Promise<Readonly<{ userId: string; organizationId?: string; sessionId?: string }>>;
  lookupCountry?(input: Readonly<{ tenantId: string; ipAddress: string }>): Promise<GeoIpLookupResult>;
  listActiveMemberships(
    input: Readonly<{
      organizationId: string;
      userId: string;
    }>,
  ): Promise<readonly { id: string; roleSlug: string }[]>;
  updateMembershipRole(
    input: Readonly<{
      membershipId: string;
      roleSlug: string;
    }>,
  ): Promise<Readonly<{ id: string; userId: string; roleSlug: string }>>;
  stagePrivilegeChange(
    input: Readonly<{
      tenantId: string;
      userId: string;
      membershipId: string;
      actorId: string;
      previousRole: string;
      currentRole: string;
    }>,
  ): Promise<Readonly<{ id: string; expiresAt: string }>>;
  expirePrivilegeChange(intentId: string): Promise<void>;
  recordDeviceAttestation?(proof: DeviceAttestationProof): Promise<void>;
  sendDeviceAlert?(alert: Readonly<Record<string, unknown>>): Promise<Readonly<{ status: number; response: unknown }>>;
}>;

export async function executeWorkOsStagingAction(
  action: WorkOsStagingAction,
  environment: NodeJS.ProcessEnv,
  client: WorkOsStagingActionClient = createWorkOsStagingActionClient(environment),
) {
  if (!action.execute) throw new Error('A real WorkOS staging action requires --execute.');

  const organizationId = required(environment, 'WORKOS_ORGANIZATION_ID');
  const allowedUserIds = csv(environment.WORKOS_ALLOWED_USER_IDS);
  const allowedRoleSlugs = csv(environment.WORKOS_ALLOWED_ROLE_SLUGS);

  if (action.kind === 'password-login' || action.kind === 'device-login') {
    validateLoginInput(action);
    const matches = (await client.findUsersByEmail(action.email)).filter(
      user => user.email.toLowerCase() === action.email.toLowerCase(),
    );
    if (matches.length !== 1) throw new Error('The staging email must resolve to exactly one WorkOS user.');
    const user = matches[0]!;
    if (allowedUserIds.size > 0 && !allowedUserIds.has(user.id))
      throw new Error('The WorkOS user is not in WORKOS_ALLOWED_USER_IDS.');

    let countryPolicy:
      | Readonly<{
          countryCode: string;
          disposition: 'incident' | 'benign-closed';
        }>
      | undefined;
    if (action.kind === 'password-login') {
      if (!action.ipAddress)
        throw new Error(
          'The staging country scenario requires --ip=<public-ip> so IPinfo can verify the policy before login.',
        );
      if (!client.lookupCountry) throw new Error('The country staging client is incomplete.');
      const geo = await client.lookupCountry({
        tenantId: organizationId,
        ipAddress: action.ipAddress,
      });
      if (geo.outcome !== 'known') throw new Error(`IPinfo could not verify the staging IP (${geo.reasonCode}).`);
      countryPolicy = Object.freeze({
        countryCode: geo.countryCode,
        disposition: geo.countryCode === REFERENCE_ALLOWED_COUNTRY ? 'benign-closed' : 'incident',
      });
    }

    const authenticated = await client.authenticateWithPassword({
      email: action.email,
      password: action.password,
      ...(action.ipAddress ? { ipAddress: action.ipAddress } : {}),
      ...(action.userAgent ? { userAgent: action.userAgent } : {}),
    });
    if (authenticated.userId !== user.id || authenticated.organizationId !== organizationId)
      throw new Error('WorkOS authenticated outside the configured staging scope.');

    if (action.kind === 'device-login') {
      if (!authenticated.sessionId) throw new Error('WorkOS did not return a verifiable session ID.');
      if (!client.recordDeviceAttestation || !client.sendDeviceAlert)
        throw new Error('The device-trust staging client is incomplete.');
      const source = environment.DEVICE_TRUST_ALERT_SOURCE ?? 'first-party-device-trust';
      const issuedAt = new Date().toISOString();
      const sourceEventId = `device_login_${randomUUID()}`;
      const proof = createEphemeralDeviceAttestation({
        schemaVersion: 1,
        attestationId: `device_attestation_${randomUUID()}`,
        source,
        sourceEventId,
        tenantId: organizationId,
        subjectId: user.id,
        sessionId: authenticated.sessionId,
        issuedAt,
        expiresAt: new Date(Date.parse(issuedAt) + 5 * 60_000).toISOString(),
      });
      await client.recordDeviceAttestation(proof);
      const delivery = await client.sendDeviceAlert({
        schemaVersion: 1,
        source,
        sourceEventId,
        kind: 'unknown_device_login',
        occurredAt: issuedAt,
        tenantId: organizationId,
        subjectId: user.id,
        sessionId: authenticated.sessionId,
        deviceId: proof.payload.deviceId,
        ...(action.ipAddress ? { ip: action.ipAddress } : {}),
        actor: { id: user.id, type: 'user' },
        target: { id: proof.payload.deviceId, type: 'device' },
        changes: { attestationId: proof.payload.attestationId },
      });
      if (delivery.status < 200 || delivery.status >= 300)
        throw new Error(`Device alert delivery failed with status ${delivery.status}.`);
      return Object.freeze({
        mode: 'staging' as const,
        provider: 'workos+first-party-device-trust' as const,
        action: 'device-login' as const,
        userId: user.id,
        organizationId,
        sessionId: authenticated.sessionId,
        deviceId: proof.payload.deviceId,
        attestationId: proof.payload.attestationId,
        expectedEvent: 'unknown_device_login' as const,
        deliveryStatus: delivery.status,
        credentialsExposed: false as const,
        tokensExposed: false as const,
      });
    }

    if (!countryPolicy) throw new Error('The country policy preflight did not complete.');

    return Object.freeze({
      mode: 'staging' as const,
      provider: 'workos' as const,
      action: 'password-login' as const,
      userId: user.id,
      organizationId,
      expectedEvent: 'session.created' as const,
      countryPolicy,
      credentialsExposed: false as const,
      tokensExposed: false as const,
    });
  }

  if (allowedUserIds.size > 0 && !allowedUserIds.has(action.userId))
    throw new Error('The WorkOS user is not in WORKOS_ALLOWED_USER_IDS.');
  if (!allowedRoleSlugs.has(action.roleSlug))
    throw new Error('The requested role is not in WORKOS_ALLOWED_ROLE_SLUGS.');
  if (action.roleSlug !== 'admin') throw new Error('The unauthorized privilege scenario requires --role=admin.');
  if (!action.actorId.trim() || action.actorId.length > 128)
    throw new Error('The staging actor ID must contain 1 to 128 characters.');
  const memberships = await client.listActiveMemberships({
    organizationId,
    userId: action.userId,
  });
  if (memberships.length !== 1)
    throw new Error('The staging user must have exactly one active membership in the configured organization.');
  const membership = memberships[0]!;
  if (membership.roleSlug === action.roleSlug) throw new Error('The WorkOS membership already has the requested role.');
  const intent = await client.stagePrivilegeChange({
    tenantId: organizationId,
    userId: action.userId,
    membershipId: membership.id,
    actorId: action.actorId,
    previousRole: membership.roleSlug,
    currentRole: action.roleSlug,
  });
  let updated: Awaited<ReturnType<WorkOsStagingActionClient['updateMembershipRole']>>;
  try {
    updated = await client.updateMembershipRole({
      membershipId: membership.id,
      roleSlug: action.roleSlug,
    });
    if (updated.id !== membership.id || updated.userId !== action.userId || updated.roleSlug !== action.roleSlug)
      throw new Error('WorkOS returned an unexpected membership after the update.');
  } catch (error) {
    // A failed or ambiguous provider response must not leave authority for a
    // later unrelated membership event. If WorkOS applied the change despite
    // the error, its webhook safely falls back to manual review.
    await client.expirePrivilegeChange(intent.id);
    throw error;
  }

  return Object.freeze({
    mode: 'staging' as const,
    provider: 'workos' as const,
    action: 'membership-role-change' as const,
    userId: action.userId,
    membershipId: membership.id,
    actorId: action.actorId,
    previousRole: membership.roleSlug,
    currentRole: updated.roleSlug,
    intentId: intent.id,
    intentExpiresAt: intent.expiresAt,
    expectedEvent: 'organization_membership.updated' as const,
    baselineSource: 'workos-api' as const,
    authorizationState: 'intentionally-unapproved' as const,
  });
}

export function createWorkOsStagingActionClient(environment: NodeJS.ProcessEnv): WorkOsStagingActionClient {
  const apiKey = required(environment, 'WORKOS_API_KEY');
  const clientId = required(environment, 'WORKOS_CLIENT_ID');
  const workos = new WorkOS({ apiKey, clientId });
  return {
    findUsersByEmail: async email => {
      const response = await workos.userManagement.listUsers({
        email,
        limit: 10,
      });
      return response.data.map(user => ({ id: user.id, email: user.email }));
    },
    authenticateWithPassword: async input => {
      const response = await workos.userManagement.authenticateWithPassword({
        clientId,
        email: input.email,
        password: input.password,
        ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
        ...(input.userAgent ? { userAgent: input.userAgent } : {}),
      });
      return {
        userId: response.user.id,
        ...(response.organizationId ? { organizationId: response.organizationId } : {}),
        ...(sessionIdFromAccessToken(response.accessToken)
          ? { sessionId: sessionIdFromAccessToken(response.accessToken) }
          : {}),
      };
    },
    lookupCountry: async ({ tenantId, ipAddress }) => {
      const store = createLibSqlOperationalStore(readStorageConfig(environment));
      try {
        await migrateOperationalStore(store);
        const config = readIntegrationConfig(environment);
        const provider = createGeoIpProvider(config, { store });
        if (!provider) throw new Error('IPinfo is not configured.');
        return await provider.lookup({
          tenantId,
          ip: ipAddress,
          deadline: new Date(Date.now() + config.ipinfo.timeoutMs),
        });
      } finally {
        store.close();
      }
    },
    listActiveMemberships: async ({ organizationId, userId }) => {
      const response = await workos.userManagement.listOrganizationMemberships({
        organizationId,
        userId,
        statuses: ['active'],
        limit: 10,
      });
      return response.data.map(membership => ({
        id: membership.id,
        roleSlug: membership.role.slug,
      }));
    },
    updateMembershipRole: async ({ membershipId, roleSlug }) => {
      const membership = await workos.userManagement.updateOrganizationMembership(membershipId, {
        roleSlug,
      });
      return {
        id: membership.id,
        userId: membership.userId,
        roleSlug: membership.role.slug,
      };
    },
    stagePrivilegeChange: async input => {
      const store = createLibSqlOperationalStore(readStorageConfig(environment));
      try {
        await migrateOperationalStore(store);
        const intent = await stageUnauthorizedPrivilegeChange(store, {
          tenantId: input.tenantId,
          subjectId: input.userId,
          membershipId: input.membershipId,
          actorId: input.actorId,
          previousRole: input.previousRole,
          currentRole: input.currentRole,
        });
        return { id: intent.id, expiresAt: intent.expiresAt };
      } finally {
        store.close();
      }
    },
    expirePrivilegeChange: async intentId => {
      const store = createLibSqlOperationalStore(readStorageConfig(environment));
      try {
        await expireStagingPrivilegeChange(store, intentId);
      } finally {
        store.close();
      }
    },
    recordDeviceAttestation: async proof => {
      const store = createLibSqlOperationalStore(readStorageConfig(environment));
      try {
        await migrateOperationalStore(store);
        await recordDeviceAttestation(store, proof);
      } finally {
        store.close();
      }
    },
    sendDeviceAlert: async alert => {
      const body = JSON.stringify(alert);
      // The normalized-alert contract uses Unix time in milliseconds. Keep
      // this identical to scripts/local-fixture-alert.ts and the receiver's
      // strict 13-digit parser; WorkOS's webhook format is a separate boundary.
      const timestamp = String(Date.now());
      const signature = createHmac('sha256', required(environment, 'ALERT_WEBHOOK_SECRET'))
        .update(`${timestamp}.`, 'utf8')
        .update(body, 'utf8')
        .digest('hex');
      const endpoint =
        environment.ALERT_WEBHOOK_URL ?? `http://localhost:${environment.PORT ?? '3000'}/webhooks/alerts`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-alert-signature': `t=${timestamp},v1=${signature}`,
        },
        body,
      });
      return {
        status: response.status,
        response: await response.json().catch(() => null),
      };
    },
  };
}

function validateLoginInput(action: Extract<WorkOsStagingAction, { kind: 'password-login' | 'device-login' }>): void {
  if (!/^\S+@\S+\.\S+$/u.test(action.email)) throw new Error('--user must be a valid email address.');
  if (action.password.length === 0) throw new Error('Password input cannot be empty.');
  if (action.kind === 'password-login' && !action.ipAddress)
    throw new Error('The staging country scenario requires --ip=<public-ip>.');
  if (action.ipAddress && isIP(action.ipAddress) === 0) throw new Error('--ip must be a valid IPv4 or IPv6 address.');
  if (action.userAgent && action.userAgent.length > 512)
    throw new Error('--user-agent must contain at most 512 characters.');
}

function sessionIdFromAccessToken(accessToken: string): string | undefined {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return undefined;
    const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object') return undefined;
    const sessionId = (parsed as Record<string, unknown>).sid;
    return typeof sessionId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/u.test(sessionId)
      ? sessionId
      : undefined;
  } catch {
    return undefined;
  }
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function csv(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean),
  );
}
