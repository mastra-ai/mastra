import type { KnowledgeImporterDefinition, KnowledgeImporterResolver } from '@mastra/core/knowledge';

import type { ConnectClientOptions, ProjectConnection, ResolvedClient } from './client.js';
import { listProjectConnections, proxyRequest, resolveClient } from './client.js';
import { MastraConnectError } from './errors.js';
import type {
  ImporterAccess,
  ImporterProviderRegistration,
  ImporterProxyRequest,
  ImporterScopesResolver,
} from './importer-registry.js';
import { IMPORTERS } from './importer-registry.js';
import { isParameterizedScope } from './importer-runtime.js';
import './providers/importers.js';

export interface ImportersIntegrationOptions {
  /** Pin a specific connection id (bypasses env-var fallback and single-active-connection resolution). */
  connectionId?: string;
  /** Exclude this provider entirely, even if a connection exists. */
  disabled?: boolean;
  /** Convenience: single-scope owner grant. Equivalent to `{ access: { [scope]: 'owner' } }`. */
  scope?: string;
  /** Explicit scope → role map. Required if `scope` is not set. */
  access?: ImporterAccess;
  /**
   * Dynamic destination scopes, resolved at each cron fire (e.g. one
   * `resource:<projectId>` per active project). Requires an explicit `access`
   * map — use parameterized keys (`{ 'resource:$projectId': 'owner' }`) so the
   * resolved scopes are writable. Concrete `access` keys still sync as static
   * destinations alongside the dynamic set.
   */
  scopes?: ImporterScopesResolver;
  /** Cron override; defaults to the provider's `defaultSchedule`. */
  schedule?: string;
}

export interface ImportersOptions {
  /** Platform project whose connections to discover. Falls back to MASTRA_PROJECT_ID. */
  projectId?: string;
  /** Per-provider config keyed by integrationId. A provider with no entry is skipped. */
  integrations?: Record<string, ImportersIntegrationOptions>;
  client?: ConnectClientOptions;
  /** How long a resolved snapshot stays fresh, in milliseconds. Default 30_000. `0` revalidates every resolution. */
  ttlMs?: number;
}

interface NormalizedRequest {
  registration: ImporterProviderRegistration;
  options: ImportersIntegrationOptions;
  access: ImporterAccess;
  schedule: string;
}

const DEFAULT_TTL_MS = 30_000;
const FAILURE_COOLDOWN_MS = 30_000;

/**
 * Live async resolver of `KnowledgeImporterDefinition[]` over the project's
 * Platform connections. Pass it straight to `new Knowledge({ importers })` —
 * the runner calls it at the top of every scheduling tick, so connections
 * attached or detached on the platform start/stop syncing without a restart.
 *
 * Configuration errors (missing project id, invalid ttl, unknown provider,
 * missing scope/access, unknown provider in `integrations`) throw at call time.
 * Per-integration resolution problems (needs re-auth, ambiguity, no active
 * connection) warn-and-skip so one bad integration never fails the whole set.
 */
export type ImportersResolver = KnowledgeImporterResolver & {
  /** Drops the cached snapshot; the next resolution fetches fresh from the platform. */
  invalidate(): void;
  /** Fetches importers from the platform now and updates the cache. Rejects if the platform fetch fails. */
  refresh(): Promise<readonly KnowledgeImporterDefinition[]>;
};

export function importers(options: ImportersOptions = {}): ImportersResolver {
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
  const requests = buildRequests(options.integrations);

  const warnedMissing = new Set<string>();
  let cache: { snapshot: readonly KnowledgeImporterDefinition[]; fetchedAt: number } | undefined;
  let inflight: Promise<readonly KnowledgeImporterDefinition[]> | undefined;
  let lastFailureAt: number | undefined;

  const refresh = (): Promise<readonly KnowledgeImporterDefinition[]> => {
    if (!inflight) {
      inflight = (async () => {
        try {
          const connections = await listProjectConnections(client, projectId);
          const snapshot = mapImporters(connections, requests, client, warnedMissing);
          cache = { snapshot, fetchedAt: Date.now() };
          lastFailureAt = undefined;
          return snapshot;
        } catch (error) {
          lastFailureAt = Date.now();
          throw error;
        } finally {
          inflight = undefined;
        }
      })();
    }
    return inflight;
  };

  const resolve = async (): Promise<readonly KnowledgeImporterDefinition[]> => {
    if (cache && Date.now() - cache.fetchedAt < ttlMs) {
      return cache.snapshot;
    }
    if (cache) {
      const staleSnapshot = cache.snapshot;
      const inCooldown = lastFailureAt !== undefined && Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS;
      if (!inCooldown && !inflight) {
        const staleFetchedAt = cache.fetchedAt;
        void refresh().catch((error: unknown) => {
          console.warn(
            `[@mastra/connect] Keeping cached importers (fetched ${Date.now() - staleFetchedAt}ms ago); platform refresh failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
      }
      return staleSnapshot;
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

function buildRequests(integrations: ImportersOptions['integrations']): NormalizedRequest[] {
  const overrides = integrations ?? {};
  for (const integrationId of Object.keys(overrides)) {
    if (!IMPORTERS.some(p => p.integrationId === integrationId)) {
      throw new MastraConnectError(
        'invalid_options',
        `Unknown importer provider '${integrationId}' in integrations option. Known providers: ${
          IMPORTERS.map(p => p.integrationId).join(', ') || '(none shipped in this package build)'
        }.`,
      );
    }
  }
  const requests: NormalizedRequest[] = [];
  for (const registration of IMPORTERS) {
    const opts = overrides[registration.integrationId];
    if (!opts) continue;
    if (opts.disabled) continue;
    const access = resolveAccess(registration.integrationId, opts);
    const schedule = (opts.schedule?.trim() || registration.defaultSchedule).trim();
    if (!schedule) {
      throw new MastraConnectError(
        'invalid_options',
        `Importer '${registration.integrationId}' schedule cannot be empty.`,
      );
    }
    requests.push({ registration, options: opts, access, schedule });
  }
  return requests;
}

function resolveAccess(integrationId: string, opts: ImportersIntegrationOptions): ImporterAccess {
  if (opts.scopes !== undefined && typeof opts.scopes !== 'function') {
    throw new MastraConnectError('invalid_options', `Importer '${integrationId}' scopes must be a function.`);
  }
  if (opts.access) {
    const entries = Object.entries(opts.access);
    if (entries.length === 0) {
      throw new MastraConnectError(
        'invalid_options',
        `Importer '${integrationId}' access map cannot be empty; provide at least one scope.`,
      );
    }
    // Parameterized keys are authority patterns, not destinations. Without a
    // dynamic scopes resolver there must be at least one concrete destination,
    // or the importer would register with nothing to sync.
    if (!opts.scopes && entries.every(([scope]) => isParameterizedScope(scope))) {
      throw new MastraConnectError(
        'invalid_options',
        `Importer '${integrationId}' access map only has parameterized scopes; add a concrete scope or a 'scopes' resolver.`,
      );
    }
    return Object.freeze(Object.fromEntries(entries));
  }
  if (opts.scopes) {
    throw new MastraConnectError(
      'invalid_options',
      `Importer '${integrationId}' dynamic 'scopes' requires an explicit 'access' map (e.g. { 'resource:$projectId': 'owner' }).`,
    );
  }
  const scope = opts.scope?.trim();
  if (!scope) {
    throw new MastraConnectError(
      'invalid_options',
      `Importer '${integrationId}' requires 'scope' or 'access' in integrations config.`,
    );
  }
  return Object.freeze({ [scope]: 'owner' as const });
}

function mapImporters(
  connections: ProjectConnection[],
  requests: NormalizedRequest[],
  client: ResolvedClient,
  warnedMissing: Set<string>,
): readonly KnowledgeImporterDefinition[] {
  const byIntegrationId = groupByIntegrationId(connections);
  const definitions: KnowledgeImporterDefinition[] = [];

  for (const request of requests) {
    const integrationId = request.registration.integrationId;
    const candidates = byIntegrationId.get(integrationId) ?? [];
    if (candidates.length === 0) {
      if (!warnedMissing.has(integrationId)) {
        warnedMissing.add(integrationId);
        console.warn(
          `[@mastra/connect] No ${integrationId} connection in this project yet; its importers will appear automatically once one is attached.`,
        );
      }
      continue;
    }
    const chosen = pickConnections(request, candidates);
    for (const connection of chosen) {
      let created: KnowledgeImporterDefinition;
      try {
        created = request.registration.createImporter({
          connection,
          request: (opts: ImporterProxyRequest) => proxyRequest(client, connection.id, opts),
          access: request.access,
          schedule: request.schedule,
          ...(request.options.scopes ? { scopes: request.options.scopes } : {}),
        });
      } catch (error) {
        console.warn(
          `[@mastra/connect] Skipping ${integrationId} connection ${connection.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }
      definitions.push({ ...created, id: `connect:${integrationId}:${connection.id}` });
    }
  }
  return Object.freeze(definitions);
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

function readEnvConnectionId(registration: ImporterProviderRegistration): string | undefined {
  return process.env[registration.envVar]?.trim() || undefined;
}

/**
 * Selects connections to instantiate importers for. `connectionId` pin (or the
 * env-var fallback) picks exactly one; otherwise every active connection for
 * the provider produces its own importer definition — the plan explicitly
 * calls for one definition per active connection.
 */
function pickConnections(request: NormalizedRequest, candidates: ProjectConnection[]): ProjectConnection[] {
  const integrationId = request.registration.integrationId;
  const directed = request.options.connectionId?.trim() || readEnvConnectionId(request.registration);
  if (directed) {
    const match = candidates.find(c => c.id === directed);
    if (!match) {
      console.warn(
        `[@mastra/connect] Skipping ${integrationId}: pinned connection ${directed} is not attached to this project.`,
      );
      return [];
    }
    if (match.status === 'needs_reauth') {
      console.warn(`[@mastra/connect] Skipping ${integrationId}: connection ${directed} needs re-auth.`);
      return [];
    }
    if (match.status !== 'active') {
      console.warn(
        `[@mastra/connect] Skipping ${integrationId}: connection ${directed} is not active (status '${match.status}').`,
      );
      return [];
    }
    return [match];
  }
  const active = candidates.filter(c => c.status === 'active');
  if (active.length === 0) {
    console.warn(
      `[@mastra/connect] Skipping ${integrationId}: no active connections (found ${candidates.length} in other states).`,
    );
    return [];
  }
  return active;
}
