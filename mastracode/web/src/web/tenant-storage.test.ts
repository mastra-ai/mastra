import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __clearTenantStorageCache, getUserStorage, resolveTenantStorage, tenantKeyFor } from './tenant-storage.js';

const provisionTursoTenant = vi.fn();
const isTursoProvisioningEnabled = vi.fn(() => false);

vi.mock('./tenant-provisioner.js', () => ({
  provisionTursoTenant: (...args: unknown[]) => provisionTursoTenant(...args),
  isTursoProvisioningEnabled: () => isTursoProvisioningEnabled(),
}));

const ORIGINAL_ENV = { ...process.env };
let tmpRoot: string;

beforeEach(() => {
  __clearTenantStorageCache();
  provisionTursoTenant.mockReset();
  isTursoProvisioningEnabled.mockReset();
  isTursoProvisioningEnabled.mockReturnValue(false);
  delete process.env.MASTRACODE_TENANT_DB_URL_TEMPLATE;
  delete process.env.MASTRACODE_TENANT_VECTOR_URL_TEMPLATE;
  delete process.env.MASTRACODE_TENANT_DB_AUTH_TOKEN;
  delete process.env.MASTRACODE_TENANT_VECTOR_AUTH_TOKEN;
  tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'mc-tenant-'));
  process.env.MASTRACODE_TENANT_DB_ROOT = tmpRoot;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('tenantKeyFor', () => {
  it('produces a stable filesystem-safe sha256 hex key', () => {
    const key = tenantKeyFor({ userId: 'user_workos_12345' });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(tenantKeyFor({ userId: 'user_workos_12345' })).toBe(key);
  });

  it('produces distinct keys for distinct users', () => {
    expect(tenantKeyFor({ userId: 'user_a' })).not.toBe(tenantKeyFor({ userId: 'user_b' }));
  });

  it('produces distinct keys for the same user in different orgs', () => {
    expect(tenantKeyFor({ orgId: 'org_a', userId: 'user_a' })).not.toBe(
      tenantKeyFor({ orgId: 'org_b', userId: 'user_a' }),
    );
  });

  it('produces distinct keys for different users in the same org', () => {
    expect(tenantKeyFor({ orgId: 'org_a', userId: 'user_a' })).not.toBe(
      tenantKeyFor({ orgId: 'org_a', userId: 'user_b' }),
    );
  });

  it('falls back to a user-only key for personal (no-org) accounts', () => {
    expect(tenantKeyFor({ orgId: undefined, userId: 'user_a' })).toBe(tenantKeyFor({ userId: 'user_a' }));
  });

  it('does not collide an org-scoped key with a user-only key', () => {
    expect(tenantKeyFor({ orgId: 'org_a', userId: 'user_a' })).not.toBe(tenantKeyFor({ userId: 'user_a' }));
  });
});

describe('resolveTenantStorage (local libSQL)', () => {
  it('creates a hashed per-tenant directory with separate storage and vector DBs', async () => {
    const { tenantKey, storageConfig } = await resolveTenantStorage({ userId: 'user_a' });
    const dir = path.join(tmpRoot, tenantKey);
    expect(existsSync(dir)).toBe(true);
    expect(storageConfig.backend).toBe('libsql');
    expect(storageConfig.isRemote).toBe(false);
    expect(storageConfig.url).toBe(`file:${path.join(dir, 'storage.db')}`);
    expect(storageConfig.vectorUrl).toBe(`file:${path.join(dir, 'vectors.db')}`);
  });

  it('gives distinct users distinct DB paths', async () => {
    const a = await resolveTenantStorage({ userId: 'user_a' });
    const b = await resolveTenantStorage({ userId: 'user_b' });
    expect(a.tenantKey).not.toBe(b.tenantKey);
    expect(a.storageConfig.url).not.toBe(b.storageConfig.url);
    expect(a.storageConfig.vectorUrl).not.toBe(b.storageConfig.vectorUrl);
  });

  it('never uses the raw workos id as a path component', async () => {
    const rawId = 'user/with/../traversal';
    const { tenantKey, storageConfig } = await resolveTenantStorage({ userId: rawId });
    expect(tenantKey).toMatch(/^[0-9a-f]{64}$/);
    expect(storageConfig.url).not.toContain('..');
    expect(storageConfig.url).toContain(tenantKey);
  });

  it('rejects an empty user id', async () => {
    await expect(resolveTenantStorage({ userId: '' })).rejects.toThrow();
  });
});

describe('resolveTenantStorage (remote URL template)', () => {
  it('expands the {id} placeholder for storage and vector urls', async () => {
    process.env.MASTRACODE_TENANT_DB_URL_TEMPLATE = 'libsql://{id}-org.turso.io';
    process.env.MASTRACODE_TENANT_VECTOR_URL_TEMPLATE = 'libsql://{id}-vec.turso.io';
    process.env.MASTRACODE_TENANT_DB_AUTH_TOKEN = 'tok_storage';
    process.env.MASTRACODE_TENANT_VECTOR_AUTH_TOKEN = 'tok_vector';

    const { tenantKey, storageConfig } = await resolveTenantStorage({ userId: 'user_a' });
    expect(storageConfig.isRemote).toBe(true);
    expect(storageConfig.url).toBe(`libsql://${tenantKey}-org.turso.io`);
    expect(storageConfig.vectorUrl).toBe(`libsql://${tenantKey}-vec.turso.io`);
    expect(storageConfig.authToken).toBe('tok_storage');
    expect(storageConfig.vectorAuthToken).toBe('tok_vector');
  });

  it('falls back to the storage url and token for vectors when no vector template is set', async () => {
    process.env.MASTRACODE_TENANT_DB_URL_TEMPLATE = 'libsql://{id}.turso.io';
    process.env.MASTRACODE_TENANT_DB_AUTH_TOKEN = 'tok_shared';

    const { storageConfig } = await resolveTenantStorage({ userId: 'user_a' });
    expect(storageConfig.vectorUrl).toBe(storageConfig.url);
    expect(storageConfig.vectorAuthToken).toBe('tok_shared');
  });

  it('does not touch the local filesystem when a template is configured', async () => {
    process.env.MASTRACODE_TENANT_DB_URL_TEMPLATE = 'libsql://{id}.turso.io';
    const { tenantKey } = await resolveTenantStorage({ userId: 'user_a' });
    expect(existsSync(path.join(tmpRoot, tenantKey))).toBe(false);
  });

  it('prefers the explicit template over Turso provisioning', async () => {
    process.env.MASTRACODE_TENANT_DB_URL_TEMPLATE = 'libsql://{id}.turso.io';
    isTursoProvisioningEnabled.mockReturnValue(true);

    const { storageConfig } = await resolveTenantStorage({ userId: 'user_a' });
    expect(storageConfig.url).toContain('.turso.io');
    expect(provisionTursoTenant).not.toHaveBeenCalled();
  });
});

describe('resolveTenantStorage (Turso auto-provisioning)', () => {
  it('provisions the tenant DB and returns a remote libsql descriptor', async () => {
    isTursoProvisioningEnabled.mockReturnValue(true);
    provisionTursoTenant.mockResolvedValue({
      url: 'libsql://mc-abc123.turso.io',
      authToken: 'jwt_token',
      vectorUrl: 'libsql://mc-abc123.turso.io',
      vectorAuthToken: 'jwt_token',
    });

    const { tenantKey, storageConfig } = await resolveTenantStorage({ orgId: 'org_a', userId: 'user_a' });
    expect(provisionTursoTenant).toHaveBeenCalledWith(tenantKey);
    expect(storageConfig.backend).toBe('libsql');
    expect(storageConfig.isRemote).toBe(true);
    expect(storageConfig.url).toBe('libsql://mc-abc123.turso.io');
    expect(storageConfig.authToken).toBe('jwt_token');
    expect(storageConfig.vectorUrl).toBe('libsql://mc-abc123.turso.io');
    expect(storageConfig.vectorAuthToken).toBe('jwt_token');
    expect(existsSync(path.join(tmpRoot, tenantKey))).toBe(false);
  });

  it('propagates a provisioning failure instead of falling back to local files', async () => {
    isTursoProvisioningEnabled.mockReturnValue(true);
    provisionTursoTenant.mockRejectedValue(new Error('turso down'));

    await expect(resolveTenantStorage({ userId: 'user_a' })).rejects.toThrow('turso down');
  });
});

describe('getUserStorage caching', () => {
  it('returns the same cached descriptor for the same identity', async () => {
    const first = await getUserStorage({ orgId: 'org_a', userId: 'user_a' });
    const second = await getUserStorage({ orgId: 'org_a', userId: 'user_a' });
    expect(second).toBe(first);
  });

  it('returns distinct descriptors for distinct users', async () => {
    const a = await getUserStorage({ userId: 'user_a' });
    const b = await getUserStorage({ userId: 'user_b' });
    expect(a).not.toBe(b);
    expect(a.tenantKey).not.toBe(b.tenantKey);
  });

  it('returns distinct descriptors for the same user in different orgs', async () => {
    const a = await getUserStorage({ orgId: 'org_a', userId: 'user_a' });
    const b = await getUserStorage({ orgId: 'org_b', userId: 'user_a' });
    expect(a).not.toBe(b);
    expect(a.tenantKey).not.toBe(b.tenantKey);
  });

  it('provisions only once for concurrent first-hits of the same tenant', async () => {
    isTursoProvisioningEnabled.mockReturnValue(true);
    provisionTursoTenant.mockResolvedValue({
      url: 'libsql://mc-x.turso.io',
      authToken: 'jwt',
      vectorUrl: 'libsql://mc-x.turso.io',
      vectorAuthToken: 'jwt',
    });

    const [a, b] = await Promise.all([
      getUserStorage({ orgId: 'org_a', userId: 'user_a' }),
      getUserStorage({ orgId: 'org_a', userId: 'user_a' }),
    ]);
    expect(a).toBe(b);
    expect(provisionTursoTenant).toHaveBeenCalledTimes(1);
  });
});
