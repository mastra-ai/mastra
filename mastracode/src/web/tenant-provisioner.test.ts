import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock drizzle's eq() into a plain descriptor we can read in the fake DB.
vi.mock('drizzle-orm', () => ({
  eq: (_column: any, value: any) => ({ kind: 'eq', value }),
}));

// ── Fake app Postgres (tenant_databases mapping table) ──────────────────────
// Mirrors the fake-DB harness used in routes-scenario.test.ts: a single
// in-memory rows array, with select().from().where() filtering on tenant_key
// and insert().values().onConflictDoNothing() honoring the primary key.
interface TenantDbRow {
  tenantKey: string;
  dbName: string;
  hostname: string;
}
let rows: TenantDbRow[] = [];
let appDbConfigured = true;

function filterByTenantKey(cond: any): TenantDbRow[] {
  // The provisioner always queries `eq(tenantDatabases.tenantKey, key)`.
  if (!cond || cond.kind !== 'eq') return [...rows];
  return rows.filter(r => r.tenantKey === cond.value);
}

vi.mock('./github/db.js', () => ({
  isAppDbConfigured: () => appDbConfigured,
  getAppDb: () => ({
    select: () => ({
      from: () => ({
        where: async (cond: any) => filterByTenantKey(cond),
      }),
    }),
    insert: () => ({
      values: (vals: TenantDbRow) => ({
        onConflictDoNothing: async () => {
          if (!rows.some(r => r.tenantKey === vals.tenantKey)) rows.push({ ...vals });
        },
      }),
    }),
  }),
}));

// ── Mock Turso Platform API client ──────────────────────────────────────────
const createDb = vi.fn();
const getDb = vi.fn();
const createToken = vi.fn();
const createClient = vi.fn((_opts: unknown) => ({
  databases: { create: createDb, get: getDb, createToken },
}));

vi.mock('@tursodatabase/api', () => ({ createClient: (opts: unknown) => createClient(opts) }));

import {
  __resetTursoClient,
  isTursoProvisioningEnabled,
  lookupTenantDb,
  provisionTursoTenant,
  recordTenantDb,
  tursoDbName,
} from './tenant-provisioner.js';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  rows = [];
  appDbConfigured = true;
  __resetTursoClient();
  createDb.mockReset();
  getDb.mockReset();
  createToken.mockReset();
  createClient.mockClear();
  createToken.mockResolvedValue({ jwt: 'jwt-default' });
  process.env.MASTRACODE_TURSO_PLATFORM_TOKEN = 'platform-token';
  process.env.MASTRACODE_TURSO_ORG = 'my-org';
  delete process.env.MASTRACODE_TURSO_GROUP;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  __resetTursoClient();
});

describe('tursoDbName', () => {
  it('is deterministic and Turso-safe', () => {
    const key = 'f'.repeat(64);
    const name = tursoDbName(key);
    expect(name).toMatch(/^mc-[a-z0-9-]+$/);
    expect(name).not.toMatch(/[^a-z0-9-]/);
    expect(tursoDbName(key)).toBe(name);
  });

  it('stays well under the length limit', () => {
    expect(tursoDbName('a'.repeat(200)).length).toBeLessThanOrEqual(43);
  });

  it('produces distinct names for distinct tenant keys', () => {
    expect(tursoDbName('a'.repeat(64))).not.toBe(tursoDbName('b'.repeat(64)));
  });
});

describe('isTursoProvisioningEnabled', () => {
  it('is true only when both the platform token and org are set', () => {
    expect(isTursoProvisioningEnabled()).toBe(true);
    delete process.env.MASTRACODE_TURSO_ORG;
    expect(isTursoProvisioningEnabled()).toBe(false);
    delete process.env.MASTRACODE_TURSO_PLATFORM_TOKEN;
    expect(isTursoProvisioningEnabled()).toBe(false);
  });
});

describe('provisionTursoTenant', () => {
  const tenantKey = 'a'.repeat(64);

  it('creates the database, persists the mapping, and mints a token', async () => {
    createDb.mockResolvedValue({ hostname: 'mc-host.turso.io' });
    createToken.mockResolvedValue({ jwt: 'jwt-fresh' });

    const result = await provisionTursoTenant(tenantKey);

    expect(createDb).toHaveBeenCalledWith(tursoDbName(tenantKey), { group: 'default' });
    expect(result.url).toBe('libsql://mc-host.turso.io');
    expect(result.authToken).toBe('jwt-fresh');
    expect(result.vectorUrl).toBe('libsql://mc-host.turso.io');
    expect(result.vectorAuthToken).toBe('jwt-fresh');
    // Mapping was persisted.
    const mapping = await lookupTenantDb(tenantKey);
    expect(mapping).toEqual({ dbName: tursoDbName(tenantKey), hostname: 'mc-host.turso.io' });
  });

  it('honours MASTRACODE_TURSO_GROUP', async () => {
    process.env.MASTRACODE_TURSO_GROUP = 'prod';
    createDb.mockResolvedValue({ hostname: 'h.turso.io' });
    await provisionTursoTenant(tenantKey);
    expect(createDb).toHaveBeenCalledWith(tursoDbName(tenantKey), { group: 'prod' });
  });

  it('recovers from an "already exists" race via databases.get', async () => {
    createDb.mockRejectedValue(new Error('database already exists'));
    getDb.mockResolvedValue({ hostname: 'mc-existing.turso.io' });

    const result = await provisionTursoTenant(tenantKey);

    expect(getDb).toHaveBeenCalledWith(tursoDbName(tenantKey));
    expect(result.url).toBe('libsql://mc-existing.turso.io');
    const mapping = await lookupTenantDb(tenantKey);
    expect(mapping?.hostname).toBe('mc-existing.turso.io');
  });

  it('reuses the persisted mapping and mints a fresh token without re-creating', async () => {
    await recordTenantDb(tenantKey, tursoDbName(tenantKey), 'mc-known.turso.io');
    createToken.mockResolvedValue({ jwt: 'jwt-known' });

    const result = await provisionTursoTenant(tenantKey);

    expect(createDb).not.toHaveBeenCalled();
    expect(createToken).toHaveBeenCalledWith(tursoDbName(tenantKey));
    expect(result.url).toBe('libsql://mc-known.turso.io');
    expect(result.authToken).toBe('jwt-known');
  });

  it('mints a fresh token on every resolution', async () => {
    await recordTenantDb(tenantKey, tursoDbName(tenantKey), 'mc-known.turso.io');
    createToken.mockResolvedValueOnce({ jwt: 'jwt-1' }).mockResolvedValueOnce({ jwt: 'jwt-2' });

    const first = await provisionTursoTenant(tenantKey);
    const second = await provisionTursoTenant(tenantKey);

    expect(first.authToken).toBe('jwt-1');
    expect(second.authToken).toBe('jwt-2');
    expect(createToken).toHaveBeenCalledTimes(2);
  });

  it('throws when the app database is not configured', async () => {
    appDbConfigured = false;
    await expect(provisionTursoTenant(tenantKey)).rejects.toThrow(/APP_DATABASE_URL/);
    expect(createDb).not.toHaveBeenCalled();
  });

  it('rethrows a non-"already exists" create error', async () => {
    createDb.mockRejectedValue(new Error('rate limited'));
    await expect(provisionTursoTenant(tenantKey)).rejects.toThrow('rate limited');
    expect(getDb).not.toHaveBeenCalled();
  });
});
