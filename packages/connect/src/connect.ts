import type { ToolsInput } from '@mastra/core/agent';

import type { ConnectClientOptions, ProjectConnection } from './client.js';
import { listProjectConnections, resolveClient } from './client.js';
import { MastraConnectError } from './errors.js';
import type { ProviderKey, ProviderRegistration } from './registry.js';
import { PROVIDERS, findProviderByIntegrationId } from './registry.js';

export interface ConnectIntegrationOptions {
  connectionId?: string;
  allowTools?: string[];
}

export interface ConnectOptions {
  /** Platform project whose connections to discover. Falls back to MASTRA_PROJECT_ID. */
  projectId?: string;
  /**
   * Integration allowlist. When provided, only listed providers are returned:
   * `true` (or an options object) includes a provider, `false` excludes it.
   * Providers listed but absent from the project's connections throw.
   */
  integrations?: Partial<Record<ProviderKey, ConnectIntegrationOptions | boolean>>;
  client?: ConnectClientOptions;
}

interface ResolvedIntegrationRequest {
  key: ProviderKey;
  registration: ProviderRegistration;
  explicit: boolean;
  options: ConnectIntegrationOptions;
}

/**
 * Discovers the project's platform connections and returns a toolset per
 * connected provider, suitable for an agent's `toolsets` option.
 */
export async function connect(options?: ConnectOptions): Promise<Record<string, ToolsInput>> {
  const projectId = options?.projectId?.trim() || process.env.MASTRA_PROJECT_ID?.trim();
  if (!projectId) {
    throw new MastraConnectError('missing_project_id', 'Missing project id: set MASTRA_PROJECT_ID or pass projectId.');
  }

  const client = resolveClient(options?.client);
  const connections = await listProjectConnections(client, projectId);

  const byIntegrationId = new Map<string, ProjectConnection[]>();
  for (const connection of connections) {
    const list = byIntegrationId.get(connection.integrationId) ?? [];
    list.push(connection);
    byIntegrationId.set(connection.integrationId, list);
  }

  const requests = buildRequests(options?.integrations, byIntegrationId);

  const result: Record<string, ToolsInput> = {};
  for (const request of requests) {
    const candidates = byIntegrationId.get(request.registration.integrationId) ?? [];
    const connectionId = resolveProviderConnection(request, candidates);
    if (!connectionId) continue; // warned + skipped
    result[request.key] = request.registration.createTools({
      connectionId,
      allowTools: request.options.allowTools,
      client: options?.client,
    });
  }
  return result;
}

/** Builds the list of providers to resolve: the allowlist when given, else every supported connected provider. */
function buildRequests(
  integrations: ConnectOptions['integrations'],
  byIntegrationId: Map<string, ProjectConnection[]>,
): ResolvedIntegrationRequest[] {
  if (integrations) {
    const requests: ResolvedIntegrationRequest[] = [];
    for (const [key, value] of Object.entries(integrations) as [ProviderKey, ConnectIntegrationOptions | boolean][]) {
      if (value === false) continue;
      const registration = PROVIDERS[key];
      if (!registration) {
        throw new MastraConnectError(
          'connection_not_found',
          `Unknown integration '${key}' in connect() options: no such provider is supported by @mastra/connect.`,
        );
      }
      const options = value === true ? {} : value;
      if (!byIntegrationId.has(registration.integrationId)) {
        throw new MastraConnectError(
          'connection_not_found',
          `No ${key} connection found in this project. Connect ${key} on the Mastra platform or remove it from connect() integrations.`,
        );
      }
      requests.push({ key, registration, explicit: true, options });
    }
    return requests;
  }

  const requests: ResolvedIntegrationRequest[] = [];
  for (const integrationId of byIntegrationId.keys()) {
    const found = findProviderByIntegrationId(integrationId);
    if (!found) {
      const ids = (byIntegrationId.get(integrationId) ?? []).map(connection => connection.id).join(', ');
      console.warn(
        `[@mastra/connect] Skipping unsupported integration '${integrationId}' (connection ${ids}): no toolset is registered for it.`,
      );
      continue;
    }
    requests.push({ key: found.key, registration: found.registration, explicit: false, options: {} });
  }
  return requests;
}

function readEnvConnectionId(registration: ProviderRegistration): string | undefined {
  return process.env[registration.envVar]?.trim() || undefined;
}

/**
 * Resolves the connection to use for one provider, per the contract:
 * option/env var wins; else a single active connection; ambiguity throws for
 * explicitly requested providers and warns+skips otherwise. A needs_reauth
 * connection is never silently mapped.
 */
function resolveProviderConnection(
  request: ResolvedIntegrationRequest,
  candidates: ProjectConnection[],
): string | undefined {
  const directed = request.options.connectionId?.trim() || readEnvConnectionId(request.registration);
  if (directed) {
    const match = candidates.find(connection => connection.id === directed);
    if (match?.status === 'needs_reauth') {
      throw new MastraConnectError(
        'needs_reauth',
        `Connection ${directed} (${request.key}) needs re-authentication. Reconnect it on the Mastra platform.`,
      );
    }
    return directed;
  }

  const active = candidates.filter(connection => connection.status === 'active');
  if (active.length === 1) return active[0]!.id;

  if (active.length === 0) {
    const reauth = candidates.filter(connection => connection.status === 'needs_reauth');
    if (reauth.length > 0) {
      if (request.explicit) {
        throw new MastraConnectError(
          'needs_reauth',
          `All ${request.key} connections need re-authentication (${reauth.map(connection => connection.id).join(', ')}). Reconnect on the Mastra platform.`,
        );
      }
      console.warn(
        `[@mastra/connect] Skipping ${request.key}: its connection(s) need re-authentication (${reauth.map(connection => connection.id).join(', ')}).`,
      );
      return undefined;
    }
    // No usable candidates (e.g. only connections in an unknown status).
    if (request.explicit) {
      throw new MastraConnectError(
        'connection_not_found',
        `No usable ${request.key} connection found in this project (${candidates.map(connection => `${connection.id}: ${connection.status}`).join(', ')}).`,
      );
    }
    console.warn(
      `[@mastra/connect] Skipping ${request.key}: no usable connection (${candidates.map(connection => `${connection.id}: ${connection.status}`).join(', ')}).`,
    );
    return undefined;
  }

  const ids = active.map(connection => connection.id).join(', ');
  if (request.explicit) {
    throw new MastraConnectError(
      'multiple_connections',
      `Multiple ${request.key} connections found (${ids}). Set ${request.registration.envVar} or pass integrations.${request.key}.connectionId to choose one.`,
    );
  }
  console.warn(
    `[@mastra/connect] Skipping ${request.key}: multiple connections found (${ids}). Set ${request.registration.envVar} to choose one.`,
  );
  return undefined;
}
