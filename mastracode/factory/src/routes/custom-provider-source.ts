/**
 * DB-backed custom providers source for model resolution (factory mode).
 *
 * The SDK's `resolveModel` and gateway catalog ask the registered
 * `CustomProvidersSource` synchronously, so this module keeps a small per-org
 * **snapshot** of custom provider rows hydrated from the `custom-providers`
 * domain. Once registered the source is authoritative — the factory never
 * reads `settings.json` custom providers, in either auth mode.
 *
 * Whose rows a call sees is decided in one place, {@link customProviderOwner},
 * which the settings routes and model catalogs use too. Calls without an
 * authenticated tenant in tenant mode (the boot-time catalog) resolve to an
 * empty list.
 *
 * Snapshots are primed per request by `createCustomProvidersPrimer` (mounted
 * after the web auth gate) and invalidated on writes via
 * `invalidateCustomProvidersSnapshots` so changes are visible immediately.
 */

import { resolveTenantFromRequestContext } from '@mastra/code-sdk/agents/credential-resolver';
import type { CredentialScope } from '@mastra/code-sdk/agents/credential-resolver';
import { setCustomProvidersSource } from '@mastra/code-sdk/agents/custom-provider-source';
import type { MastraCodeCustomProvider } from '@mastra/code-sdk/agents/mastracode-gateway';
import type { RequestContext } from '@mastra/core/request-context';
import type { MiddlewareHandler } from 'hono';

import type { CustomProviderOwner, CustomProvidersStorage } from '../storage/domains/custom-providers/base.js';
import { tenantOrgId } from './provider-credentials.js';
import type { RouteAuth } from './route.js';

/** How long a hydrated snapshot is considered fresh. */
const SNAPSHOT_TTL_MS = 15_000;

/** Cap on cached org snapshots; oldest-inserted evicted beyond this. */
const MAX_CACHED_ORGS = 1000;

/** Sentinel org for no-auth mode. */
const LOCAL_ORG = 'local';

/**
 * Whose custom providers apply to a tenant at a credential scope, or
 * `undefined` to fail closed (tenant mode without identity). Model
 * resolution, the settings routes and the model catalogs all decide through
 * this function, so what a user sees in Settings is what their models use.
 *
 * Scoped exactly like provider credentials: Factory-scoped work uses the
 * organization's list, personal work the account's own, and the two never
 * mix. No-auth mode has one shared list.
 */
export function customProviderOwner(
  tenant: { orgId?: string; userId: string; credentialScope?: CredentialScope } | undefined,
  authEnabled: boolean,
): CustomProviderOwner | undefined {
  if (!authEnabled) return { orgId: LOCAL_ORG };
  if (!tenant) return undefined;
  const orgId = tenantOrgId(tenant);
  return tenant.credentialScope === 'factory' ? { orgId } : { orgId, userId: tenant.userId };
}

class OrgCustomProvidersSnapshot {
  readonly #orgId: string;
  readonly #storage: CustomProvidersStorage;
  #organization: MastraCodeCustomProvider[] = [];
  #members = new Map<string, MastraCodeCustomProvider[]>();
  #fetchedAt = 0;
  /** Bumped by every write, so a load that started before it can't count as fresh. */
  #generation = 0;
  #hydrating: Promise<void> | undefined;

  constructor(orgId: string, storage: CustomProvidersStorage) {
    this.#orgId = orgId;
    this.#storage = storage;
  }

  #isStale(): boolean {
    return Date.now() - this.#fetchedAt >= SNAPSHOT_TTL_MS;
  }

  /**
   * Hydrate the snapshot when stale; coalesces concurrent callers. Loads again
   * if a write lands while a load is in flight, so callers never settle for
   * rows read before that write.
   */
  async ensureFresh(): Promise<void> {
    while (this.#isStale()) {
      this.#hydrating ??= this.#hydrate().finally(() => {
        this.#hydrating = undefined;
      });
      await this.#hydrating;
    }
  }

  /**
   * After a write: load again on the next read, but keep serving the current
   * rows meanwhile, so runs already using these providers don't lose them.
   */
  markStale(): void {
    this.#generation += 1;
    this.#fetchedAt = 0;
  }

  /**
   * Loads the organization's providers and every member's in one pass: a
   * session can run as its owner while another member's request primed the
   * snapshot, so any owner in the org must be servable without a second query.
   */
  async #hydrate(): Promise<void> {
    const generation = this.#generation;
    await this.#storage.ensureReady();
    const organization: MastraCodeCustomProvider[] = [];
    const members = new Map<string, MastraCodeCustomProvider[]>();
    for (const record of await this.#storage.listForOrg(this.#orgId)) {
      const provider: MastraCodeCustomProvider = {
        name: record.name,
        url: record.url,
        apiKey: record.apiKey ?? undefined,
        models: record.models,
      };
      const owned = record.userId === null ? organization : (members.get(record.userId) ?? []);
      owned.push(provider);
      if (record.userId !== null) members.set(record.userId, owned);
    }
    this.#organization = organization;
    this.#members = members;
    if (generation === this.#generation) this.#fetchedAt = Date.now();
  }

  /** Sync by contract; kicks a background re-hydrate when the snapshot is stale. */
  get(owner: CustomProviderOwner): MastraCodeCustomProvider[] {
    if (this.#isStale()) {
      void this.ensureFresh().catch(() => {});
    }
    return owner.userId === undefined ? this.#organization : (this.#members.get(owner.userId) ?? []);
  }
}

const orgSnapshots = new Map<string, OrgCustomProvidersSnapshot>();

let registered: { storage: CustomProvidersStorage; authEnabled: boolean } | undefined;

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
  registered = { storage, authEnabled };
  // Snapshots read the storage they were created with.
  orgSnapshots.clear();
  setCustomProvidersSource(tenant => {
    const owner = customProviderOwner(tenant, authEnabled);
    if (!owner) return [];
    return snapshotFor(owner.orgId, storage).get(owner);
  });
}

/**
 * After a custom provider write, reload the org's snapshot on its next read
 * instead of after the TTL, so the change reaches the next request at once.
 */
export function invalidateCustomProvidersSnapshots(tenant: { orgId: string }): void {
  orgSnapshots.get(tenant.orgId)?.markStale();
}

/** Test hook: clear registration and cached org snapshots. */
export function resetCustomProvidersSourceForTests(): void {
  setCustomProvidersSource(undefined);
  registered = undefined;
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
    const owner = customProviderOwner(auth.tenant(c), authEnabled);
    if (owner) {
      try {
        await snapshotFor(owner.orgId, storage).ensureFresh();
      } catch {
        // Fail open: model calls serve the last snapshot (or none).
      }
    }
    await next();
  };
}

/**
 * Prime the org snapshot for a run that has no inbound request (a notification
 * or peer-signal wake), so its first model call can resolve a custom-provider
 * model. Best-effort like the request primer: a failed hydrate serves the last
 * snapshot.
 */
export async function primeCustomProvidersForRequestContext(requestContext: RequestContext): Promise<void> {
  if (!registered) return;
  const owner = customProviderOwner(resolveTenantFromRequestContext(requestContext), registered.authEnabled);
  if (!owner) return;
  try {
    await snapshotFor(owner.orgId, registered.storage).ensureFresh();
  } catch {
    // Fail open: model calls serve the last snapshot (or none).
  }
}
