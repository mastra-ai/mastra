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
   * Providers listed but absent from the project's connections are skipped
   * (with a one-time warning) until a connection is attached.
   */
  integrations?: Partial<Record<ProviderKey, ConnectIntegrationOptions | boolean>>;
  client?: ConnectClientOptions;
  /** How long a resolved snapshot stays fresh, in milliseconds. Default 30_000. `0` revalidates on every resolution. */
  ttlMs?: number;
}

/**
 * Live toolset resolver returned by `connect()`. Pass it straight to an
 * agent's dynamic `tools` argument: Mastra calls it per generate/stream, so
 * project integrations attached or detached on the platform are reflected
 * without restarting the server. Call it directly (`await tools()`) when you
 * need a plain toolsets record, e.g. for an agent's `toolsets` option.
 */
export interface ConnectTools {
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

const DEFAULT_TTL_MS = 30_000;

/**
 * Returns a live toolset resolver over the project's platform connections.
 * The resolver serves a cached snapshot of one toolset per connected
 * provider, revalidating from the platform every `ttlMs`, so integrations
 * attached to (or detached from) the project are picked up (or dropped) by
 * running agents without a restart.
 *
 * Configuration errors (missing project id/token, unknown integration keys,
 * bad ttlMs) throw here — at connect() call time — so they surface at
 * startup. Per-integration problems during resolution (needs re-auth,
 * ambiguity, not attached yet) are downgraded to warn-and-skip so one bad
 * integration never takes down the whole toolset.
 */
export function connect(options: ConnectOptions = {}): ConnectTools {
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
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

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
          const snapshot = mapToolsets(connections, options, warnedMissing, warnedUnsupported);
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
function mapToolsets(
  connections: ProjectConnection[],
  options: ConnectOptions,
  warnedMissing: Set<ProviderKey>,
  warnedUnsupported: Set<string>,
): Record<string, ToolsInput> {
  const byIntegrationId = groupByIntegrationId(connections);
  const requests = buildRequests(options.integrations, byIntegrationId, warnedUnsupported);

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
      const connectionId = resolveProviderConnection(request, candidates);
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
 * every supported connected provider. Allowlisted providers without a
 * connection yet are kept so they can appear once a connection is attached.
 */
function buildRequests(
  integrations: ConnectOptions['integrations'],
  byIntegrationId: Map<string, ProjectConnection[]>,
  warnedUnsupported: Set<string>,
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
      requests.push({ key, registration, explicit: true, options: value === true ? {} : value });
    }
    return requests;
  }

  const requests: ResolvedIntegrationRequest[] = [];
  for (const integrationId of byIntegrationId.keys()) {
    const found = findProviderByIntegrationId(integrationId);
    if (!found) {
      // This mapping re-runs on every refresh: warn once per integration id
      // instead of spamming the log on every TTL cycle.
      if (!warnedUnsupported.has(integrationId)) {
        warnedUnsupported.add(integrationId);
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
 * option/env var wins; else a single active connection; anything else
 * (ambiguity, needs_reauth, no usable candidate) warns and skips so one bad
 * integration never takes down the whole toolset resolution. A needs_reauth
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
      console.warn(
        `[@mastra/connect] Skipping ${request.key}: its connection(s) need re-authentication (${reauth.map(connection => connection.id).join(', ')}).`,
      );
      return undefined;
    }
    // No usable candidates (e.g. only connections in an unknown status).
    console.warn(
      `[@mastra/connect] Skipping ${request.key}: no usable connection (${candidates.map(connection => `${connection.id}: ${connection.status}`).join(', ')}).`,
    );
    return undefined;
  }

  console.warn(
    `[@mastra/connect] Skipping ${request.key}: multiple connections found (${active.map(connection => connection.id).join(', ')}). Set ${request.registration.envVar} to choose one.`,
  );
  return undefined;
}
