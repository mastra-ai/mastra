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
   * In snapshot mode, providers listed but absent from the project's
   * connections throw; in live mode they are skipped (with a one-time warning)
   * until a connection is attached.
   */
  integrations?: Partial<Record<ProviderKey, ConnectIntegrationOptions | boolean>>;
  client?: ConnectClientOptions;
}

export interface ConnectLiveOptions extends ConnectOptions {
  /**
   * Live mode: instead of resolving toolsets once, connect() returns a
   * resolver compatible with an agent's dynamic `tools` argument. Mastra
   * invokes it on every generate/stream, and it serves a cached snapshot of
   * the project's toolsets, revalidating from the platform every `ttlMs`.
   * Integrations attached to (or detached from) the project on the Mastra
   * platform are picked up (or dropped) by running agents without a restart.
   */
  live: true;
  /** How long a resolved snapshot stays fresh, in milliseconds. Default 30_000. `0` revalidates on every resolution. */
  ttlMs?: number;
}

/**
 * Live toolset resolver returned by `connect({ live: true })`. Pass it
 * straight to an agent's dynamic `tools` argument: Mastra calls it per
 * generate/stream, so project integrations attached or detached on the
 * platform are reflected without restarting the server.
 */
export interface ConnectLiveTools {
  (ctx?: { requestContext?: unknown; mastra?: unknown }): Promise<Record<string, ToolsInput>>;
  /** Drops the cached snapshot; the next resolution fetches fresh from the platform. */
  invalidate(): void;
  /** Fetches toolsets from the platform now and updates the cache. */
  refresh(): Promise<Record<string, ToolsInput>>;
}

interface ResolvedIntegrationRequest {
  key: ProviderKey;
  registration: ProviderRegistration;
  explicit: boolean;
  options: ConnectIntegrationOptions;
}

const DEFAULT_LIVE_TTL_MS = 30_000;

/**
 * Discovers the project's platform connections and returns a toolset per
 * connected provider, suitable for an agent's `toolsets` option.
 *
 * With `live: true`, returns a resolver instead of a one-time snapshot (see
 * {@link ConnectLiveOptions}).
 */
export function connect(options: ConnectLiveOptions): ConnectLiveTools;
export function connect(options?: ConnectOptions): Promise<Record<string, ToolsInput>>;
export function connect(
  options?: ConnectOptions | ConnectLiveOptions,
): Promise<Record<string, ToolsInput>> | ConnectLiveTools {
  if (options && 'live' in options && options.live) {
    return createLiveConnect(options);
  }

  return connectSnapshot(options);
}

async function connectSnapshot(options?: ConnectOptions): Promise<Record<string, ToolsInput>> {
  const projectId = options?.projectId?.trim() || process.env.MASTRA_PROJECT_ID?.trim();
  if (!projectId) {
    throw new MastraConnectError('missing_project_id', 'Missing project id: set MASTRA_PROJECT_ID or pass projectId.');
  }

  const client = resolveClient(options?.client);
  const connections = await listProjectConnections(client, projectId);

  const byIntegrationId = groupByIntegrationId(connections);
  const requests = buildRequests(options?.integrations, byIntegrationId, { requireConnected: true });

  const result: Record<string, ToolsInput> = {};
  for (const request of requests) {
    const candidates = byIntegrationId.get(request.registration.integrationId) ?? [];
    const connectionId = resolveProviderConnection(request, candidates, true);
    if (!connectionId) continue; // warned + skipped
    result[request.key] = request.registration.createTools({
      connectionId,
      allowTools: request.options.allowTools,
      client: options?.client,
    });
  }
  return result;
}

/**
 * Builds the live resolver. Configuration errors (missing project id/token,
 * unknown integration keys, bad ttlMs) throw here — at connect() call time —
 * so they surface at startup, never on a request path.
 */
function createLiveConnect(options: ConnectLiveOptions): ConnectLiveTools {
  const projectId = options.projectId?.trim() || process.env.MASTRA_PROJECT_ID?.trim();
  if (!projectId) {
    throw new MastraConnectError('missing_project_id', 'Missing project id: set MASTRA_PROJECT_ID or pass projectId.');
  }
  if (options.ttlMs !== undefined && (!Number.isFinite(options.ttlMs) || options.ttlMs < 0)) {
    throw new MastraConnectError(
      'invalid_options',
      `Invalid ttlMs (${options.ttlMs}): expected a finite number of milliseconds >= 0.`,
    );
  }
  const ttlMs = options.ttlMs ?? DEFAULT_LIVE_TTL_MS;

  const client = resolveClient(options.client);
  validateIntegrationKeys(options.integrations);

  const warnedMissing = new Set<ProviderKey>();
  const warnedUnsupported = new Set<string>();
  let cache: { snapshot: Record<string, ToolsInput>; fetchedAt: number } | undefined;
  let inflight: Promise<Record<string, ToolsInput>> | undefined;

  const refresh = (): Promise<Record<string, ToolsInput>> => {
    if (!inflight) {
      inflight = (async () => {
        try {
          const connections = await listProjectConnections(client, projectId);
          const snapshot = mapLiveToolsets(connections, options, warnedMissing, warnedUnsupported);
          cache = { snapshot, fetchedAt: Date.now() };
          return snapshot;
        } catch (error) {
          if (cache) {
            console.warn(
              `[@mastra/connect] Keeping cached toolsets (fetched ${Date.now() - cache.fetchedAt}ms ago); platform refresh failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            return cache.snapshot;
          }
          throw error;
        } finally {
          inflight = undefined;
        }
      })();
    }
    return inflight;
  };

  const resolve = async (): Promise<Record<string, ToolsInput>> => {
    if (cache && Date.now() - cache.fetchedAt < ttlMs) {
      return cache.snapshot;
    }
    if (cache) {
      // Stale: serve the snapshot now and revalidate in the background.
      void refresh().catch(() => {});
      return cache.snapshot;
    }
    return refresh();
  };

  return Object.assign(resolve, {
    invalidate: (): void => {
      cache = undefined;
    },
    refresh,
  });
}

/** Maps one platform connection list snapshot to toolsets, downgrading every per-provider failure to warn+skip. */
function mapLiveToolsets(
  connections: ProjectConnection[],
  options: ConnectLiveOptions,
  warnedMissing: Set<ProviderKey>,
  warnedUnsupported: Set<string>,
): Record<string, ToolsInput> {
  const byIntegrationId = groupByIntegrationId(connections);
  const requests = buildRequests(options.integrations, byIntegrationId, {
    requireConnected: false,
    warnedUnsupported,
  });

  const result: Record<string, ToolsInput> = {};
  for (const request of requests) {
    try {
      const candidates = byIntegrationId.get(request.registration.integrationId) ?? [];
      if (candidates.length === 0) {
        if (!warnedMissing.has(request.key)) {
          warnedMissing.add(request.key);
          console.warn(
            `[@mastra/connect] No ${request.key} connection in this project yet; its tools will appear automatically once one is attached.`,
          );
        }
        continue;
      }
      const connectionId = resolveProviderConnection(request, candidates, false);
      if (!connectionId) continue; // warned + skipped
      result[request.key] = request.registration.createTools({
        connectionId,
        allowTools: request.options.allowTools,
        client: options.client,
      });
    } catch (error) {
      console.warn(
        `[@mastra/connect] Skipping ${request.key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return result;
}

function groupByIntegrationId(connections: ProjectConnection[]): Map<string, ProjectConnection[]> {
  const byIntegrationId = new Map<string, ProjectConnection[]>();
  for (const connection of connections) {
    const list = byIntegrationId.get(connection.integrationId) ?? [];
    list.push(connection);
    byIntegrationId.set(connection.integrationId, list);
  }
  return byIntegrationId;
}

function validateIntegrationKeys(integrations: ConnectOptions['integrations']): void {
  if (!integrations) return;
  for (const key of Object.keys(integrations)) {
    if (!PROVIDERS[key as ProviderKey]) {
      throw new MastraConnectError(
        'connection_not_found',
        `Unknown integration '${key}' in connect() options: no such provider is supported by @mastra/connect.`,
      );
    }
  }
}

/**
 * Builds the list of providers to resolve: the allowlist when given, else
 * every supported connected provider. With `requireConnected: false` (live
 * mode), allowlisted providers without a connection yet are kept so they can
 * appear once a connection is attached.
 */
function buildRequests(
  integrations: ConnectOptions['integrations'],
  byIntegrationId: Map<string, ProjectConnection[]>,
  opts: { requireConnected: boolean; warnedUnsupported?: Set<string> },
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
        if (opts.requireConnected) {
          throw new MastraConnectError(
            'connection_not_found',
            `No ${key} connection found in this project. Connect ${key} on the Mastra platform or remove it from connect() integrations.`,
          );
        }
        // Live mode: keep the request; mapping warns once and skips until attached.
        requests.push({ key, registration, explicit: true, options });
        continue;
      }
      requests.push({ key, registration, explicit: true, options });
    }
    return requests;
  }

  const requests: ResolvedIntegrationRequest[] = [];
  for (const integrationId of byIntegrationId.keys()) {
    const found = findProviderByIntegrationId(integrationId);
    if (!found) {
      // Live mode re-runs this mapping on every refresh: warn once per
      // integration id instead of spamming the log on every TTL cycle.
      if (!opts.warnedUnsupported?.has(integrationId)) {
        opts.warnedUnsupported?.add(integrationId);
        const ids = (byIntegrationId.get(integrationId) ?? []).map(connection => connection.id).join(', ');
        console.warn(
          `[@mastra/connect] Skipping unsupported integration '${integrationId}' (connection ${ids}): no toolset is registered for it.`,
        );
      }
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
 * connection is never silently mapped. With `strict: false` (live mode) every
 * throw is downgraded to warn+skip so one bad integration never takes down
 * the whole toolset resolution.
 */
function resolveProviderConnection(
  request: ResolvedIntegrationRequest,
  candidates: ProjectConnection[],
  strict: boolean,
): string | undefined {
  const directed = request.options.connectionId?.trim() || readEnvConnectionId(request.registration);
  if (directed) {
    const match = candidates.find(connection => connection.id === directed);
    if (match?.status === 'needs_reauth') {
      if (strict) {
        throw new MastraConnectError(
          'needs_reauth',
          `Connection ${directed} (${request.key}) needs re-authentication. Reconnect it on the Mastra platform.`,
        );
      }
      console.warn(
        `[@mastra/connect] Skipping ${request.key}: connection ${directed} needs re-authentication. Reconnect it on the Mastra platform.`,
      );
      return undefined;
    }
    return directed;
  }

  const active = candidates.filter(connection => connection.status === 'active');
  if (active.length === 1) return active[0]!.id;

  if (active.length === 0) {
    const reauth = candidates.filter(connection => connection.status === 'needs_reauth');
    if (reauth.length > 0) {
      if (request.explicit && strict) {
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
    if (request.explicit && strict) {
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
  if (request.explicit && strict) {
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
