import { WorkOS } from '@workos-inc/node';

import type { IntegrationConfig } from '../env.js';
import type { OperationalStore } from '../db/operational-store.js';
import { DomainError } from '../domain/errors.js';
import type { IncidentProvider } from './incident-provider.js';
import { createLinearIncidentProvider } from './linear-incident-provider.js';
import { LocalIncidentProvider } from './local-incident-provider.js';
import {
  WorkOsIdentityProvider,
  type IdentityMutationAuthorizer,
  type WorkOsIdentityClient,
} from './identity-provider.js';
import { IpinfoLiteProvider, type GeoIpTransport } from './geoip-provider.js';

/**
 * Selects adapters once from validated configuration. Non-local runtimes never
 * replace an enabled remote integration with a local implementation.
 */
export function createIncidentProvider(
  config: IntegrationConfig,
  dependencies: Readonly<{ store?: OperationalStore }> = {},
): IncidentProvider {
  if (config.mode === 'local') return new LocalIncidentProvider(dependencies);
  if (!config.linear.enabled) {
    return new DisabledIncidentProvider();
  }
  if (!config.linear.apiKey || !config.linear.workspaceId || !config.linear.teamId || !config.linear.internalBaseUrl)
    throw new DomainError('VALIDATION_FAILED');
  return createLinearIncidentProvider({
    apiKey: config.linear.apiKey,
    workspaceId: config.linear.workspaceId,
    teamId: config.linear.teamId,
    ...(config.linear.projectId ? { projectId: config.linear.projectId } : {}),
    severityLabelIds: config.linear.severityLabelIds ?? {},
    statusStateIds: config.linear.statusStateIds ?? {},
    severityLabelNames: config.linear.severityLabelNames,
    statusStateNames: config.linear.statusStateNames,
    internalBaseUrl: config.linear.internalBaseUrl,
  });
}

class DisabledIncidentProvider implements IncidentProvider {
  readonly providerId = 'disabled' as const;
  async create(): Promise<never> {
    throw new DomainError('VALIDATION_FAILED');
  }
  async update(): Promise<never> {
    throw new DomainError('VALIDATION_FAILED');
  }
}

export function createIdentityProvider(
  config: IntegrationConfig,
  authorizeMutation: IdentityMutationAuthorizer,
  dependencies: Readonly<{ openStore?: () => OperationalStore }> = {},
): WorkOsIdentityProvider | undefined {
  if (!config.workos.enabled) return undefined;
  if (!config.workos.apiKey || !config.workos.organizationId) throw new DomainError('VALIDATION_FAILED');
  const workos = new WorkOS(config.workos.apiKey);
  const client: WorkOsIdentityClient = {
    userManagement: {
      getUser: userId => workos.userManagement.getUser(userId),
      listOrganizationMemberships: ({ userId, organizationId, statuses }) =>
        workos.userManagement.listOrganizationMemberships({
          userId,
          organizationId,
          statuses: [...statuses],
          limit: 100,
        }),
      listSessions: async ({ userId }) => workos.userManagement.listSessions(userId),
      revokeSession: async sessionId => {
        await workos.userManagement.revokeSession({ sessionId });
        return { id: sessionId, status: 'revoked' };
      },
    },
    organizations: {
      getMembership: membershipId => workos.userManagement.getOrganizationMembership(membershipId),
      updateMembership: (membershipId, input) =>
        workos.userManagement.updateOrganizationMembership(membershipId, input),
    },
  };
  return new WorkOsIdentityProvider({
    client,
    organizationId: config.workos.organizationId,
    allowedUserIds: config.workos.allowedUserIds,
    allowedRoleSlugs: config.workos.allowedRoleSlugs,
    authorizeMutation,
    ...(dependencies.openStore ? { openStore: dependencies.openStore } : {}),
    // WorkOS reads can briefly trail the webhook that announced the state.
    // Keep this below the enclosing identity-branch budget so a provider
    // timeout is reported deterministically instead of racing the wrapper.
    timeoutMs: 3_000,
  });
}

export function createGeoIpProvider(
  config: IntegrationConfig,
  dependencies: Readonly<{
    store?: OperationalStore;
    openStore?: () => OperationalStore;
    transport?: GeoIpTransport;
  }> = {},
): IpinfoLiteProvider | undefined {
  if (!config.ipinfo.enabled) return undefined;
  if (!config.ipinfo.token || !config.ipinfo.cacheHmacKey) throw new DomainError('VALIDATION_FAILED');
  return new IpinfoLiteProvider({
    token: config.ipinfo.token,
    timeoutMs: config.ipinfo.timeoutMs,
    cacheTtlMs: config.ipinfo.cacheTtlSeconds * 1_000,
    retentionDays: config.ipinfo.evidenceRetentionDays,
    cacheHmacKey: config.ipinfo.cacheHmacKey,
    cacheHmacKeyVersion: config.ipinfo.cacheHmacKeyVersion!,
    ...(config.ipinfo.previousCacheHmacKey
      ? {
          previousCacheHmacKey: config.ipinfo.previousCacheHmacKey,
          previousCacheHmacKeyVersion: config.ipinfo.previousCacheHmacKeyVersion!,
        }
      : {}),
    ...(dependencies.store ? { store: dependencies.store } : {}),
    ...(dependencies.openStore ? { openStore: dependencies.openStore } : {}),
    ...(dependencies.transport ? { transport: dependencies.transport } : {}),
  });
}
