/**
 * Per-user (tenant) storage resolution for the multi-tenant web server.
 *
 * The web server authenticates browser clients via WorkOS AuthKit (see
 * `auth.ts`). Without per-tenant isolation, every authenticated user's agent
 * state (threads, messages, memory, observational memory, recall vectors) lands
 * in a single shared storage backend — only separated by `resourceId`
 * convention. That is a hard multi-tenancy/privacy violation: a bug or a crafted
 * `resourceId` could read another tenant's conversations.
 *
 * This module resolves a dedicated, isolated libSQL database **per
 * (org, user)** so the tenant boundary is the storage backend itself, not just a
 * scoping convention. The resolver is provider-agnostic in shape (mirroring
 * `getStorageConfig`) so a hosted deployment can point at a network volume or
 * swap in remote libSQL/Turso per user via a URL template.
 *
 * Resolution strategy (highest priority first):
 *   1. `MASTRACODE_TENANT_DB_URL_TEMPLATE` — remote libSQL/Turso. The template
 *      may contain a `{id}` placeholder replaced with the filesystem-safe
 *      tenant key. Auth token from `MASTRACODE_TENANT_DB_AUTH_TOKEN`. The vector
 *      DB url comes from `MASTRACODE_TENANT_VECTOR_URL_TEMPLATE` (same `{id}`),
 *      falling back to the storage template when absent.
 *   2. Turso auto-provisioning — when `MASTRACODE_TURSO_PLATFORM_TOKEN` and
 *      `MASTRACODE_TURSO_ORG` are set, the tenant's own Turso database is
 *      created (and a scoped token minted) on first access via the Turso
 *      Platform API, then the stable mapping is persisted in the app Postgres.
 *      See `tenant-provisioner.ts`.
 *   3. Local libSQL files under `MASTRACODE_TENANT_DB_ROOT` (default
 *      `~/.mastracode/web/tenants/<sha256(orgId\0userId)>/`), with `storage.db`
 *      + `vectors.db`.
 *
 * The `(org, user)` identity is hashed (sha256, hex) to a filesystem-safe
 * directory name — the raw ids are never used as a path component, and no
 * client-supplied path ever reaches the filesystem.
 */

import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { LibSQLStorageConfig } from '../utils/project.js';
import { isTursoProvisioningEnabled, provisionTursoTenant } from './tenant-provisioner.js';

/**
 * A resolved per-tenant storage descriptor. This is a `StorageConfig`-shaped
 * value that flows into the existing `mountAgentControllerOnMastra({ storage })`
 * pipeline, so all the usual composition (composite store, observability
 * domains, memory, recall vectors) is built per tenant with no duplication.
 */
export interface TenantStorage {
  /** Filesystem-safe key derived from the (org, user) identity (sha256 hex). */
  tenantKey: string;
  /** Storage config passed to the controller factory for this tenant. */
  storageConfig: LibSQLStorageConfig;
}

/**
 * The tenant identity for agent-state isolation: a WorkOS organization plus a
 * user inside it. `orgId` is `undefined`/empty for personal (no-org) accounts,
 * which fall back to a user-only key so single-user dev keeps working.
 */
export interface TenantIdentity {
  orgId?: string;
  userId: string;
}

/**
 * Hash the `(orgId, userId)` identity to a filesystem-safe, collision-resistant
 * dir name. Two users in the same org get distinct keys; the same user across
 * two orgs gets distinct keys. Personal accounts (no org) hash the user id only,
 * so they stay stable and isolated from any org-scoped tenant.
 */
export function tenantKeyFor(identity: TenantIdentity): string {
  const composite = identity.orgId ? `${identity.orgId}\u0000${identity.userId}` : identity.userId;
  return createHash('sha256').update(composite).digest('hex');
}

/** Root directory for local per-tenant libSQL files. */
function tenantDbRoot(): string {
  const fromEnv = process.env.MASTRACODE_TENANT_DB_ROOT;
  if (fromEnv) return fromEnv;
  return path.join(os.homedir(), '.mastracode', 'web', 'tenants');
}

/** Apply a `{id}` template, tolerating templates without the placeholder. */
function applyTemplate(template: string, tenantKey: string): string {
  return template.includes('{id}') ? template.replaceAll('{id}', tenantKey) : `${template}${tenantKey}`;
}

/**
 * Resolve the storage descriptor for a tenant. Pure (no caching, no I/O beyond
 * ensuring the local directory exists) so it is easy to unit test. Use
 * {@link getUserStorage} for the cached entry point.
 */
export async function resolveTenantStorage(identity: TenantIdentity): Promise<TenantStorage> {
  if (!identity.userId) {
    throw new Error('resolveTenantStorage requires a non-empty userId');
  }
  const tenantKey = tenantKeyFor(identity);

  // 1. Remote libSQL/Turso via URL template.
  const urlTemplate = process.env.MASTRACODE_TENANT_DB_URL_TEMPLATE;
  if (urlTemplate) {
    const url = applyTemplate(urlTemplate, tenantKey);
    const vectorTemplate = process.env.MASTRACODE_TENANT_VECTOR_URL_TEMPLATE;
    const vectorUrl = vectorTemplate ? applyTemplate(vectorTemplate, tenantKey) : url;
    const authToken = process.env.MASTRACODE_TENANT_DB_AUTH_TOKEN;
    const vectorAuthToken = process.env.MASTRACODE_TENANT_VECTOR_AUTH_TOKEN ?? authToken;
    return {
      tenantKey,
      storageConfig: {
        backend: 'libsql',
        url,
        authToken,
        isRemote: true,
        vectorUrl,
        vectorAuthToken,
      },
    };
  }

  // 2. Turso auto-provisioning via the Turso Platform API.
  if (isTursoProvisioningEnabled()) {
    const provisioned = await provisionTursoTenant(tenantKey);
    return {
      tenantKey,
      storageConfig: {
        backend: 'libsql',
        url: provisioned.url,
        authToken: provisioned.authToken,
        isRemote: true,
        vectorUrl: provisioned.vectorUrl,
        vectorAuthToken: provisioned.vectorAuthToken,
      },
    };
  }

  // 3. Local libSQL files under a hashed per-tenant directory.
  const dir = path.join(tenantDbRoot(), tenantKey);
  mkdirSync(dir, { recursive: true });
  return {
    tenantKey,
    storageConfig: {
      backend: 'libsql',
      url: `file:${path.join(dir, 'storage.db')}`,
      isRemote: false,
      vectorUrl: `file:${path.join(dir, 'vectors.db')}`,
    },
  };
}

/** In-process cache of resolved tenant descriptors, keyed by tenant key. */
const tenantCache = new Map<string, TenantStorage>();

/**
 * In-flight resolution promises, keyed by tenant key. Guards against duplicate
 * concurrent provisioning when several requests for the same brand-new tenant
 * arrive before the first resolution finishes.
 */
const inFlight = new Map<string, Promise<TenantStorage>>();

/**
 * Get-or-create the cached tenant storage descriptor for an `(org, user)`
 * identity. Same identity → same cached descriptor; distinct identities →
 * distinct descriptors backed by distinct databases. Concurrent first-hits for
 * the same tenant share a single resolution (and thus a single provision call).
 */
export async function getUserStorage(identity: TenantIdentity): Promise<TenantStorage> {
  const tenantKey = tenantKeyFor(identity);
  const cached = tenantCache.get(tenantKey);
  if (cached) return cached;

  const pending = inFlight.get(tenantKey);
  if (pending) return pending;

  const promise = resolveTenantStorage(identity)
    .then(resolved => {
      tenantCache.set(resolved.tenantKey, resolved);
      return resolved;
    })
    .finally(() => {
      inFlight.delete(tenantKey);
    });
  inFlight.set(tenantKey, promise);
  return promise;
}

/**
 * True when a remote (network-backed) tenant DB backend is configured — either
 * an explicit URL template or Turso auto-provisioning.
 */
export function hasRemoteTenantDb(): boolean {
  return Boolean(process.env.MASTRACODE_TENANT_DB_URL_TEMPLATE) || isTursoProvisioningEnabled();
}

/**
 * Fail loud at startup when a remote tenant DB is required but not configured.
 * Local-file tenant DBs do not survive container restarts and are not shared
 * across replicas, so a multi-replica/ephemeral deploy must set either
 * `MASTRACODE_TENANT_DB_URL_TEMPLATE` or Turso auto-provisioning
 * (`MASTRACODE_TURSO_PLATFORM_TOKEN` + `MASTRACODE_TURSO_ORG`). Gated behind
 * `MASTRACODE_REQUIRE_REMOTE_TENANT_DB=1` so local dev is unaffected.
 */
export function assertRemoteTenantDbIfRequired(): void {
  if (process.env.MASTRACODE_REQUIRE_REMOTE_TENANT_DB !== '1') return;
  if (hasRemoteTenantDb()) return;
  throw new Error(
    'MASTRACODE_REQUIRE_REMOTE_TENANT_DB=1 but no remote tenant DB backend is configured. ' +
      'Local-file tenant databases do not persist across container restarts and are not ' +
      'shared across replicas. Set MASTRACODE_TENANT_DB_URL_TEMPLATE to a remote libSQL/Turso URL, ' +
      'or set MASTRACODE_TURSO_PLATFORM_TOKEN + MASTRACODE_TURSO_ORG to auto-provision Turso databases.',
  );
}

/** Clear the in-process tenant cache (test helper). */
export function __clearTenantStorageCache(): void {
  tenantCache.clear();
  inFlight.clear();
}
