/**
 * Turso auto-provisioning for per-tenant agent state.
 *
 * In a deployed environment each `(org, user)` tenant needs its own remote Turso
 * database — server-local libSQL files are ephemeral and not shared across
 * replicas. The `MASTRACODE_TENANT_DB_URL_TEMPLATE` mode assumes the tenant DB
 * already exists at a predictable URL; this module instead *creates* the
 * database (and a scoped auth token) via the Turso Platform API the first time a
 * tenant is seen, then persists the stable `db_name`/`hostname` mapping in the
 * app Postgres so all replicas converge on the same DB and no re-create happens
 * on cold start.
 *
 * Only the durable mapping is persisted; the auth token is minted fresh per
 * resolution so no long-lived credential is ever stored.
 *
 * The `@tursodatabase/api` client is imported dynamically so the dependency is
 * only loaded when provisioning is actually used — local dev and tests that
 * don't configure Turso never load it.
 */

import { eq } from 'drizzle-orm';
import { getAppDb, isAppDbConfigured } from './github/db.js';
import { tenantDatabases } from './github/schema.js';

/** The remote libSQL descriptor produced for a provisioned tenant. */
export interface ProvisionedTenantDb {
  url: string;
  authToken: string;
  vectorUrl: string;
  vectorAuthToken: string;
}

/** True when both the Turso platform token and org slug/id are configured. */
export function isTursoProvisioningEnabled(): boolean {
  return Boolean(process.env.MASTRACODE_TURSO_PLATFORM_TOKEN && process.env.MASTRACODE_TURSO_ORG);
}

/**
 * Derive a deterministic, Turso-safe database name from a tenant key. Turso
 * database names must be lowercase `[a-z0-9-]`, may not start/end with a dash,
 * and are length-bounded. The tenant key is already a sha256 hex string, so it
 * is safe to slice; we prefix `mc-` and bound the length to stay well under the
 * limit while remaining unique per tenant.
 */
export function tursoDbName(tenantKey: string): string {
  const safe = tenantKey.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `mc-${safe.slice(0, 40)}`;
}

/** The minimal shape of the Turso Platform API client we depend on. */
interface TursoClient {
  databases: {
    create(name: string, options?: { group?: string }): Promise<{ hostname: string; name?: string }>;
    get(name: string): Promise<{ hostname: string; name?: string }>;
    createToken(name: string): Promise<{ jwt: string }>;
  };
}

let clientPromise: Promise<TursoClient> | undefined;

/** Lazily construct (and memoize) the Turso Platform API client. */
async function getTursoClient(): Promise<TursoClient> {
  if (clientPromise) return clientPromise;
  clientPromise = (async () => {
    const token = process.env.MASTRACODE_TURSO_PLATFORM_TOKEN;
    const org = process.env.MASTRACODE_TURSO_ORG;
    if (!token || !org) {
      throw new Error('Turso provisioning requires MASTRACODE_TURSO_PLATFORM_TOKEN and MASTRACODE_TURSO_ORG.');
    }
    const mod = await import('@tursodatabase/api');
    return mod.createClient({ org, token }) as unknown as TursoClient;
  })();
  return clientPromise;
}

/** True when a Turso create error indicates the database already exists. */
function isAlreadyExists(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already exists|already in use|conflict/i.test(message);
}

/** The configured Turso group, defaulting to `default`. */
function tursoGroup(): string {
  return process.env.MASTRACODE_TURSO_GROUP || 'default';
}

/**
 * Look up an existing tenant → Turso DB mapping. Returns `undefined` when the
 * tenant has not yet been provisioned.
 */
export async function lookupTenantDb(tenantKey: string): Promise<{ dbName: string; hostname: string } | undefined> {
  const [row] = await getAppDb().select().from(tenantDatabases).where(eq(tenantDatabases.tenantKey, tenantKey));
  if (!row) return undefined;
  return { dbName: row.dbName, hostname: row.hostname };
}

/**
 * Persist a tenant → Turso DB mapping. Uses `onConflictDoNothing` so concurrent
 * replicas provisioning the same tenant converge on the first writer's row.
 */
export async function recordTenantDb(tenantKey: string, dbName: string, hostname: string): Promise<void> {
  await getAppDb().insert(tenantDatabases).values({ tenantKey, dbName, hostname }).onConflictDoNothing();
}

/** Build the remote libSQL descriptor from a hostname + freshly minted token. */
function descriptorFor(hostname: string, jwt: string): ProvisionedTenantDb {
  const url = `libsql://${hostname}`;
  return { url, authToken: jwt, vectorUrl: url, vectorAuthToken: jwt };
}

/**
 * Provision (or recover) the Turso database for a tenant and return a ready
 * remote libSQL descriptor with a freshly minted scoped token.
 *
 * Resolution:
 *   1. If a mapping already exists in Postgres, mint a token for the known DB
 *      and return — no Turso create call.
 *   2. Otherwise create the database (idempotent: an "already exists" race falls
 *      back to `databases.get`), record the mapping, mint a token, return.
 *
 * @throws if the app database is not configured — Turso provisioning needs it
 *   for the durable mapping table, and silently falling back to local files in a
 *   deployed env would defeat the isolation guarantee.
 */
export async function provisionTursoTenant(tenantKey: string): Promise<ProvisionedTenantDb> {
  if (!isAppDbConfigured()) {
    throw new Error(
      'Turso tenant provisioning requires APP_DATABASE_URL for the tenant_databases mapping table. ' +
        'Set APP_DATABASE_URL, or unset MASTRACODE_TURSO_PLATFORM_TOKEN/MASTRACODE_TURSO_ORG to use local files.',
    );
  }

  const dbName = tursoDbName(tenantKey);
  const turso = await getTursoClient();

  const existing = await lookupTenantDb(tenantKey);
  if (existing) {
    const { jwt } = await turso.databases.createToken(existing.dbName);
    return descriptorFor(existing.hostname, jwt);
  }

  let hostname: string;
  try {
    const db = await turso.databases.create(dbName, { group: tursoGroup() });
    hostname = db.hostname;
  } catch (err) {
    if (!isAlreadyExists(err)) throw err;
    const db = await turso.databases.get(dbName);
    hostname = db.hostname;
  }

  await recordTenantDb(tenantKey, dbName, hostname);
  const { jwt } = await turso.databases.createToken(dbName);
  return descriptorFor(hostname, jwt);
}

/** Reset the memoized Turso client (test helper). */
export function __resetTursoClient(): void {
  clientPromise = undefined;
}
