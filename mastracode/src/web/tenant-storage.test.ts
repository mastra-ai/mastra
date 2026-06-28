import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __clearTenantStorageCache, getUserStorage, resolveTenantStorage, tenantKeyFor } from './tenant-storage.js';

const ORIGINAL_ENV = { ...process.env };
let tmpRoot: string;

beforeEach(() => {
  __clearTenantStorageCache();
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
    const key = tenantKeyFor('user_workos_12345');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(tenantKeyFor('user_workos_12345')).toBe(key);
  });

  it('produces distinct keys for distinct ids', () => {
    expect(tenantKeyFor('user_a')).not.toBe(tenantKeyFor('user_b'));
  });
});

describe('resolveTenantStorage (local libSQL)', () => {
  it('creates a hashed per-tenant directory with separate storage and vector DBs', () => {
    const { tenantKey, storageConfig } = resolveTenantStorage('user_a');
    const dir = path.join(tmpRoot, tenantKey);
    expect(existsSync(dir)).toBe(true);
    expect(storageConfig.backend).toBe('libsql');
    expect(storageConfig.isRemote).toBe(false);
    expect(storageConfig.url).toBe(`file:${path.join(dir, 'storage.db')}`);
    expect(storageConfig.vectorUrl).toBe(`file:${path.join(dir, 'vectors.db')}`);
  });

  it('gives distinct users distinct DB paths', () => {
    const a = resolveTenantStorage('user_a');
    const b = resolveTenantStorage('user_b');
    expect(a.tenantKey).not.toBe(b.tenantKey);
    expect(a.storageConfig.url).not.toBe(b.storageConfig.url);
    expect(a.storageConfig.vectorUrl).not.toBe(b.storageConfig.vectorUrl);
  });

  it('never uses the raw workos id as a path component', () => {
    const rawId = 'user/with/../traversal';
    const { tenantKey, storageConfig } = resolveTenantStorage(rawId);
    expect(tenantKey).toMatch(/^[0-9a-f]{64}$/);
    expect(storageConfig.url).not.toContain('..');
    expect(storageConfig.url).toContain(tenantKey);
  });

  it('throws on an empty workos id', () => {
    expect(() => resolveTenantStorage('')).toThrow();
  });
});

describe('resolveTenantStorage (remote URL template)', () => {
  it('expands the {id} placeholder for storage and vector urls', () => {
    process.env.MASTRACODE_TENANT_DB_URL_TEMPLATE = 'libsql://{id}-org.turso.io';
    process.env.MASTRACODE_TENANT_VECTOR_URL_TEMPLATE = 'libsql://{id}-vec.turso.io';
    process.env.MASTRACODE_TENANT_DB_AUTH_TOKEN = 'tok_storage';
    process.env.MASTRACODE_TENANT_VECTOR_AUTH_TOKEN = 'tok_vector';

    const { tenantKey, storageConfig } = resolveTenantStorage('user_a');
    expect(storageConfig.isRemote).toBe(true);
    expect(storageConfig.url).toBe(`libsql://${tenantKey}-org.turso.io`);
    expect(storageConfig.vectorUrl).toBe(`libsql://${tenantKey}-vec.turso.io`);
    expect(storageConfig.authToken).toBe('tok_storage');
    expect(storageConfig.vectorAuthToken).toBe('tok_vector');
  });

  it('falls back to the storage url and token for vectors when no vector template is set', () => {
    process.env.MASTRACODE_TENANT_DB_URL_TEMPLATE = 'libsql://{id}.turso.io';
    process.env.MASTRACODE_TENANT_DB_AUTH_TOKEN = 'tok_shared';

    const { storageConfig } = resolveTenantStorage('user_a');
    expect(storageConfig.vectorUrl).toBe(storageConfig.url);
    expect(storageConfig.vectorAuthToken).toBe('tok_shared');
  });

  it('does not touch the local filesystem when a template is configured', () => {
    process.env.MASTRACODE_TENANT_DB_URL_TEMPLATE = 'libsql://{id}.turso.io';
    const { tenantKey } = resolveTenantStorage('user_a');
    expect(existsSync(path.join(tmpRoot, tenantKey))).toBe(false);
  });
});

describe('getUserStorage caching', () => {
  it('returns the same cached descriptor for the same user', () => {
    const first = getUserStorage('user_a');
    const second = getUserStorage('user_a');
    expect(second).toBe(first);
  });

  it('returns distinct descriptors for distinct users', () => {
    const a = getUserStorage('user_a');
    const b = getUserStorage('user_b');
    expect(a).not.toBe(b);
    expect(a.tenantKey).not.toBe(b.tenantKey);
  });
});
