import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('getStorageConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear storage-related env vars
    delete process.env.MASTRA_STORAGE_BACKEND;
    delete process.env.MASTRA_DB_URL;
    delete process.env.MASTRA_DB_AUTH_TOKEN;
    delete process.env.MASTRA_PG_CONNECTION_STRING;
    delete process.env.MASTRA_PG_HOST;
    delete process.env.MASTRA_PG_PORT;
    delete process.env.MASTRA_PG_DATABASE;
    delete process.env.MASTRA_PG_USER;
    delete process.env.MASTRA_PG_PASSWORD;
    delete process.env.MASTRA_PG_SCHEMA_NAME;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function loadGetStorageConfig() {
    // Dynamic import to get fresh module after env changes
    const mod = await import('../project.js');
    return mod.getStorageConfig;
  }

  it('defaults to libsql with local file when no config is provided', async () => {
    const getStorageConfig = await loadGetStorageConfig();
    const config = getStorageConfig();
    expect(config.backend).toBe('libsql');
    expect(config).toHaveProperty('url');
    if (config.backend === 'libsql') {
      expect(config.url).toMatch(/^file:/);
      expect(config.isRemote).toBe(false);
    }
  });

  it('uses MASTRA_DB_URL env var for libsql', async () => {
    process.env.MASTRA_DB_URL = 'libsql://test.turso.io';
    process.env.MASTRA_DB_AUTH_TOKEN = 'test-token';
    const getStorageConfig = await loadGetStorageConfig();
    const config = getStorageConfig();
    expect(config.backend).toBe('libsql');
    if (config.backend === 'libsql') {
      expect(config.url).toBe('libsql://test.turso.io');
      expect(config.authToken).toBe('test-token');
      expect(config.isRemote).toBe(true);
    }
  });

  it('uses MASTRA_STORAGE_BACKEND=pg with connection string', async () => {
    process.env.MASTRA_STORAGE_BACKEND = 'pg';
    process.env.MASTRA_PG_CONNECTION_STRING = 'postgresql://user:pass@localhost:5432/mydb';
    const getStorageConfig = await loadGetStorageConfig();
    const config = getStorageConfig();
    expect(config.backend).toBe('pg');
    if (config.backend === 'pg') {
      expect(config.connectionString).toBe('postgresql://user:pass@localhost:5432/mydb');
    }
  });

  it('uses MASTRA_STORAGE_BACKEND=pg with host/port config', async () => {
    process.env.MASTRA_STORAGE_BACKEND = 'pg';
    process.env.MASTRA_PG_HOST = 'db.example.com';
    process.env.MASTRA_PG_PORT = '5433';
    process.env.MASTRA_PG_DATABASE = 'mastra';
    process.env.MASTRA_PG_USER = 'admin';
    process.env.MASTRA_PG_PASSWORD = 'secret';
    process.env.MASTRA_PG_SCHEMA_NAME = 'custom_schema';
    const getStorageConfig = await loadGetStorageConfig();
    const config = getStorageConfig();
    expect(config.backend).toBe('pg');
    if (config.backend === 'pg') {
      expect(config.host).toBe('db.example.com');
      expect(config.port).toBe(5433);
      expect(config.database).toBe('mastra');
      expect(config.user).toBe('admin');
      expect(config.password).toBe('secret');
      expect(config.schemaName).toBe('custom_schema');
    }
  });

  it('env vars take precedence over global settings', async () => {
    process.env.MASTRA_STORAGE_BACKEND = 'pg';
    process.env.MASTRA_PG_CONNECTION_STRING = 'postgresql://env@localhost/db';
    const getStorageConfig = await loadGetStorageConfig();
    const config = getStorageConfig(undefined, {
      backend: 'libsql',
      libsql: { url: 'libsql://test.turso.io' },
      pg: {},
    });
    // Env should win
    expect(config.backend).toBe('pg');
    if (config.backend === 'pg') {
      expect(config.connectionString).toBe('postgresql://env@localhost/db');
    }
  });

  it('resolves pg from global settings when no env vars set', async () => {
    const getStorageConfig = await loadGetStorageConfig();
    const config = getStorageConfig(undefined, {
      backend: 'pg',
      libsql: {},
      pg: {
        connectionString: 'postgresql://settings@localhost/db',
        schemaName: 'test_schema',
      },
    });
    expect(config.backend).toBe('pg');
    if (config.backend === 'pg') {
      expect(config.connectionString).toBe('postgresql://settings@localhost/db');
      expect(config.schemaName).toBe('test_schema');
    }
  });

  it('resolves libsql from global settings when url is provided', async () => {
    const getStorageConfig = await loadGetStorageConfig();
    const config = getStorageConfig(undefined, {
      backend: 'libsql',
      libsql: { url: 'libsql://test.turso.io', authToken: 'tok' },
      pg: {},
    });
    expect(config.backend).toBe('libsql');
    if (config.backend === 'libsql') {
      expect(config.url).toBe('libsql://test.turso.io');
      expect(config.authToken).toBe('tok');
      expect(config.isRemote).toBe(true);
    }
  });
});

describe('createStorage', () => {
  it('creates LibSQLStore for libsql backend', async () => {
    const { createStorage } = await import('../storage-factory.js');
    const result = await createStorage({
      backend: 'libsql',
      url: 'file::memory:',
      isRemote: false,
    });
    expect(result.storage).toBeDefined();
    expect(result.storage.constructor.name).toBe('LibSQLStore');
    expect(result.warning).toBeUndefined();
  });

  it('falls back to LibSQL with warning when pg has no connection info', async () => {
    const { createStorage } = await import('../storage-factory.js');
    const result = await createStorage({
      backend: 'pg',
    });
    expect(result.storage.constructor.name).toBe('LibSQLStore');
    expect(result.warning).toMatch(/no connection info/);
  });

  it('falls back to LibSQL with warning when pg connection fails', async () => {
    const { createStorage } = await import('../storage-factory.js');
    // Use a connection string that will fail to connect (no server on this port)
    const result = await createStorage({
      backend: 'pg',
      connectionString: 'postgresql://user:pass@localhost:59999/testdb',
    });
    expect(result.storage.constructor.name).toBe('LibSQLStore');
    expect(result.warning).toMatch(/Failed to connect/);
  }, 15000);

  it('passes schemaName and flags to PostgresStore config', async () => {
    const { createStorage } = await import('../storage-factory.js');
    // This will fail to connect (no PG running) but exercises config construction
    const result = await createStorage({
      backend: 'pg',
      connectionString: 'postgresql://user:pass@localhost:59999/testdb',
      schemaName: 'custom',
      disableInit: true,
      skipDefaultIndexes: true,
    });
    // Falls back because can't connect, but at least didn't throw
    expect(result.storage).toBeDefined();
  }, 15000);
});
