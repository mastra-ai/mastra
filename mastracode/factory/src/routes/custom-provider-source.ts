/**
 * DB-backed custom providers source for model resolution (factory mode).
 *
 * The SDK's `resolveModel` and gateway catalog ask the registered
 * `CustomProvidersSource` synchronously, so this module keeps a small per-org
 * **snapshot** of custom provider rows hydrated from the `custom-providers`
 * domain. Once registered the source is authoritative — the factory never
 * reads `settings.json` custom providers, in either auth mode:
 *
 * - tenant mode: rows are scoped per org (`tenantOrgId`); calls without an
 *   authenticated tenant (boot-time catalog) resolve to an empty list.
 * - no-auth/local mode: rows live under the sentinel `local` org, matching the
 *   custom provider routes.
 *
 * Snapshots are primed per request by `createCustomProvidersPrimer` (mounted
 * after the web auth gate) and invalidated on writes via
 * `invalidateCustomProvidersSnapshots` so changes are visible immediately.
 */

import { setCustomProvidersSource } from '@mastra/code-sdk/agents/custom-provider-source';
import type { MastraCodeCustomProvider } from '@mastra/code-sdk/agents/mastracode-gateway';
import type { MiddlewareHandler } from 'hono';

import type { CustomProvidersStorage } from '../storage/domains/custom-providers/base.js';
import { tenantOrgId } from './provider-credentials.js';
import type { RouteAuth } from './route.js';

/** How long a hydrated snapshot is considered fresh. */
const SNAPSHOT_TTL_MS = 15_000;

/** Cap on cached org snapshots; oldest-inserted evicted beyond this. */
const MAX_CACHED_ORGS = 1000;

/** Sentinel org for no-auth mode — must match the custom provider routes. */
const LOCAL_ORG = 'local';

class OrgCustomProvidersSnapshot {
  readonly #orgId: string;
  readonly #storage: CustomProvidersStorage;
  #snapshot: MastraCodeCustomProvider[] = [];
  #fetchedAt = 0;
  #hydrating: Promise<void> | undefined;

  constructor(orgId: string, storage: CustomProvidersStorage) {
    this.#orgId = orgId;
    this.#storage = storage;
  }

  /** Hydrate the snapshot when stale; coalesces concurrent callers. */
  async ensureFresh(now = Date.now()): Promise<void> {
    if (now - this.#fetchedAt < SNAPSHOT_TTL_MS) return;
    this.#hydrating ??= this.#hydrate().finally(() => {
      this.#hydrating = undefined;
    });
    await this.#hydrating;
  }

  async #hydrate(): Promise<void> {
    await this.#storage.ensureReady();
    const records = await this.#storage.list({ orgId: this.#orgId });
    this.#snapshot = records.map(record => ({
      name: record.name,
      url: record.url,
      apiKey: record.apiKey ?? undefined,
      models: record.models,
    }));
    this.#fetchedAt = Date.now();
  }

  /** Sync by contract; kicks a background re-hydrate when the snapshot is stale. */
  get(): MastraCodeCustomProvider[] {
    if (Date.now() - this.#fetchedAt >= SNAPSHOT_TTL_MS) {
      void this.ensureFresh().catch(() => {});
    }
    return this.#snapshot;
  }
}

const orgSnapshots = new Map<string, OrgCustomProvidersSnapshot>();

function snapshotFor(orgId: string, storage: CustomProvidersStorage): OrgCustomProvidersSnapshot {
  let snapshot = orgSnapshots.get(orgId);
  if (!snapshot) {
    if (orgSnapshots.size >= MAX_CACHED_ORGS) {
      const oldest = orgSnapshots.keys().next().value;
      if (oldest !== undefined) orgSnapshots.delete(oldest);
    }
    snapshot = new OrgCustomProvidersSnapshot(orgId, storage);
    orgSnapshots.set(orgId, snapshot);
  }
  return snapshot;
}

/** The org a call resolves to, or `undefined` to fail closed (tenant mode without identity). */
function orgForTenant(
  tenant: { orgId?: string; userId: string } | undefined,
  authEnabled: boolean,
): string | undefined {
  if (!authEnabled) return LOCAL_ORG;
  return tenant ? tenantOrgId(tenant) : undefined;
}

/**
 * Register the DB-backed custom providers source with the SDK. Called by the
 * factory after storage init with the `custom-providers` domain handle; from
 * then on model resolution and the gateway catalog never read settings.json
 * custom providers.
 */
export function registerCustomProvidersSource({
  storage,
  authEnabled,
}: {
  storage: CustomProvidersStorage;
  authEnabled: boolean;
}): void {
  setCustomProvidersSource(tenant => {
    const orgId = orgForTenant(tenant, authEnabled);
    if (!orgId) return [];
    return snapshotFor(orgId, storage).get();
  });
}

/**
 * Drop the org's cached snapshot after a custom provider write so the change
 * is visible to the next model call immediately instead of after the TTL.
 */
export function invalidateCustomProvidersSnapshots(tenant: { orgId: string }): void {
  orgSnapshots.delete(tenant.orgId);
}

/** Test hook: clear registration and cached org snapshots. */
export function resetCustomProvidersSourceForTests(): void {
  setCustomProvidersSource(undefined);
  orgSnapshots.clear();
}

/**
 * Middleware mounted after the web auth gate: primes the caller's org snapshot
 * so the request's first model call sees their custom providers without an
 * async seam in model resolution. Cheap when fresh (TTL check), best-effort
 * when not — a failed hydrate serves the last snapshot, never blocks a request.
 */
export function createCustomProvidersPrimer({
  auth,
  storage,
  authEnabled,
}: {
  auth: RouteAuth;
  storage: CustomProvidersStorage;
  authEnabled: boolean;
}): MiddlewareHandler {
  return async (c, next) => {
    const orgId = orgForTenant(auth.tenant(c), authEnabled);
    if (orgId) {
      try {
        await snapshotFor(orgId, storage).ensureFresh();
      } catch {
        // Fail open: model calls serve the last snapshot (or none).
      }
    }
    await next();
  };
}
