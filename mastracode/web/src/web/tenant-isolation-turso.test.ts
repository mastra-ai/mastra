import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __clearTenantStorageCache, resolveTenantStorage } from './tenant-storage.js';

// Turso-mode isolation: distinct tenants resolve to distinct provisioned
// databases, and the same tenant is stable. The provisioner is mocked so the
// test never touches the network or the app Postgres; the mock derives a
// deterministic db name from the tenant key, exactly as the real provisioner
// does, so we can assert per-tenant uniqueness and stability.

const isTursoProvisioningEnabled = vi.fn(() => true);
const provisionTursoTenant = vi.fn();

vi.mock('./tenant-provisioner.js', () => ({
  isTursoProvisioningEnabled: () => isTursoProvisioningEnabled(),
  // Mirror the real provisioner: derive a stable db name from the tenant key.
  provisionTursoTenant: (tenantKey: string) => provisionTursoTenant(tenantKey),
  tursoDbName: (tenantKey: string) => `mc-${tenantKey.slice(0, 40)}`,
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  __clearTenantStorageCache();
  isTursoProvisioningEnabled.mockReset();
  isTursoProvisioningEnabled.mockReturnValue(true);
  provisionTursoTenant.mockReset();
  provisionTursoTenant.mockImplementation(async (tenantKey: string) => {
    const dbName = `mc-${tenantKey.slice(0, 40)}`;
    const url = `libsql://${dbName}.turso.io`;
    return { url, authToken: `jwt-${dbName}`, vectorUrl: url, vectorAuthToken: `jwt-${dbName}` };
  });
  delete process.env.MASTRACODE_TENANT_DB_URL_TEMPLATE;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  __clearTenantStorageCache();
});

describe('Turso-mode per-(org,user) isolation', () => {
  it('gives two distinct tenants distinct provisioned databases', async () => {
    const a = await resolveTenantStorage({ orgId: 'org_a', userId: 'user_1' });
    const b = await resolveTenantStorage({ orgId: 'org_b', userId: 'user_1' });

    expect(a.tenantKey).not.toBe(b.tenantKey);
    expect(a.storageConfig.isRemote).toBe(true);
    expect(b.storageConfig.isRemote).toBe(true);
    expect(a.storageConfig.url).not.toBe(b.storageConfig.url);
    // Each tenant's db name embeds its own tenant key.
    expect(a.storageConfig.url).toContain(a.tenantKey.slice(0, 40));
    expect(b.storageConfig.url).toContain(b.tenantKey.slice(0, 40));
  });

  it('is stable for the same tenant across resolutions', async () => {
    const first = await resolveTenantStorage({ orgId: 'org_a', userId: 'user_1' });
    __clearTenantStorageCache();
    const second = await resolveTenantStorage({ orgId: 'org_a', userId: 'user_1' });

    expect(first.tenantKey).toBe(second.tenantKey);
    expect(first.storageConfig.url).toBe(second.storageConfig.url);
  });
});
