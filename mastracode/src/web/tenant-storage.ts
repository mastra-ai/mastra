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
 * This module resolves a dedicated, isolated libSQL database **per WorkOS user**
 * so the tenant boundary is the storage backend itself, not just a scoping
 * convention. The resolver is provider-agnostic in shape (mirroring
 * `getStorageConfig`) so a hosted deployment can point at a network volume or
 * swap in remote libSQL/Turso per user via a URL template.
 *
 * Resolution strategy (highest priority first):
 *   1. `MASTRACODE_TENANT_DB_URL_TEMPLATE` — remote libSQL/Turso. The template
 *      may contain a `{id}` placeholder replaced with the filesystem-safe
 *      tenant key. Auth token from `MASTRACODE_TENANT_DB_AUTH_TOKEN`. The vector
 *      DB url comes from `MASTRACODE_TENANT_VECTOR_URL_TEMPLATE` (same `{id}`),
 *      falling back to the storage template when absent.
 *   2. Local libSQL files under `MASTRACODE_TENANT_DB_ROOT` (default
 *      `~/.mastracode/web/tenants/<sha256(workosId)>/`), with `storage.db` +
 *      `vectors.db`.
 *
 * The WorkOS user id is hashed (sha256, hex) to a filesystem-safe directory
 * name — the raw id is never used as a path component, and no client-supplied
 * path ever reaches the filesystem.
 */

import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { LibSQLStorageConfig } from '../utils/project.js';

/**
 * A resolved per-tenant storage descriptor. This is a `StorageConfig`-shaped
 * value that flows into the existing `mountAgentControllerOnMastra({ storage })`
 * pipeline, so all the usual composition (composite store, observability
 * domains, memory, recall vectors) is built per tenant with no duplication.
 */
export interface TenantStorage {
  /** Filesystem-safe key derived from the WorkOS user id (sha256 hex). */
  tenantKey: string;
  /** Storage config passed to the controller factory for this tenant. */
  storageConfig: LibSQLStorageConfig;
}

/** Hash a WorkOS user id to a filesystem-safe, collision-resistant dir name. */
export function tenantKeyFor(workosId: string): string {
  return createHash('sha256').update(workosId).digest('hex');
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
export function resolveTenantStorage(workosId: string): TenantStorage {
  if (!workosId) {
    throw new Error('resolveTenantStorage requires a non-empty workosId');
  }
  const tenantKey = tenantKeyFor(workosId);

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

  // 2. Local libSQL files under a hashed per-tenant directory.
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
 * Get-or-create the cached tenant storage descriptor for a WorkOS user. Same
 * user → same cached descriptor; distinct users → distinct descriptors backed
 * by distinct databases.
 */
export function getUserStorage(workosId: string): TenantStorage {
  const tenantKey = tenantKeyFor(workosId);
  const cached = tenantCache.get(tenantKey);
  if (cached) return cached;
  const resolved = resolveTenantStorage(workosId);
  tenantCache.set(resolved.tenantKey, resolved);
  return resolved;
}

/** Clear the in-process tenant cache (test helper). */
export function __clearTenantStorageCache(): void {
  tenantCache.clear();
}
