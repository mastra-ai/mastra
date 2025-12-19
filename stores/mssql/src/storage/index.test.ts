import { createTestSuite } from '@internal/storage-test-utils';
import sql from 'mssql';
import { describe, expect, it, vi } from 'vitest';

import { MSSQLStore } from '.';
import type { MSSQLConfig } from '.';

const TEST_CONFIG: MSSQLConfig = {
  id: process.env.MSSQL_STORE_ID || 'test-mssql-store',
  server: process.env.MSSQL_HOST || 'localhost',
  port: Number(process.env.MSSQL_PORT) || 1433,
  database: process.env.MSSQL_DB || 'master',
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || 'Your_password123',
};

const CONNECTION_STRING = `Server=${(TEST_CONFIG as any).server},${(TEST_CONFIG as any).port};Database=${(TEST_CONFIG as any).database};User Id=${(TEST_CONFIG as any).user};Password=${(TEST_CONFIG as any).password};Encrypt=true;TrustServerCertificate=true`;

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

console.log('Not running MSSQL tests in CI. You can enable them if you want to test them locally.');
if (process.env.ENABLE_TESTS === 'true') {
  createTestSuite(new MSSQLStore(TEST_CONFIG));

  describe('MSSQLStore with pre-configured pool', () => {
    it('should accept a pre-configured ConnectionPool', () => {
      const pool = new sql.ConnectionPool({
        server: (TEST_CONFIG as any).server,
        port: (TEST_CONFIG as any).port,
        database: (TEST_CONFIG as any).database,
        user: (TEST_CONFIG as any).user,
        password: (TEST_CONFIG as any).password,
        options: { encrypt: true, trustServerCertificate: true },
      });

      const store = new MSSQLStore({
        id: 'mssql-pool-test',
        pool,
      });

      expect(store).toBeDefined();
      expect(store.pool).toBe(pool);
    });

    it('should work with pre-configured pool for storage operations', async () => {
      const pool = new sql.ConnectionPool({
        server: (TEST_CONFIG as any).server,
        port: (TEST_CONFIG as any).port,
        database: (TEST_CONFIG as any).database,
        user: (TEST_CONFIG as any).user,
        password: (TEST_CONFIG as any).password,
        options: { encrypt: true, trustServerCertificate: true },
      });

      const store = new MSSQLStore({
        id: 'mssql-pool-ops-test',
        pool,
      });

      await store.init();

      // Test a basic operation
      const thread = {
        id: `thread-pool-test-${Date.now()}`,
        resourceId: 'test-resource',
        title: 'Test Thread',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const savedThread = await store.saveThread({ thread });
      expect(savedThread.id).toBe(thread.id);

      const retrievedThread = await store.getThreadById({ threadId: thread.id });
      expect(retrievedThread).toBeDefined();
      expect(retrievedThread?.title).toBe('Test Thread');

      // Clean up
      await store.deleteThread({ threadId: thread.id });
      await store.close();
    });
  });
} else {
  describe('MSSQLStore', () => {
    it('should be defined', () => {
      expect(MSSQLStore).toBeDefined();
    });
  });
}

// Configuration validation tests (run even without ENABLE_TESTS)
describe('MSSQLStore Configuration Validation', () => {
  describe('with server/port config', () => {
    it('should throw if server is empty', () => {
      expect(
        () =>
          new MSSQLStore({
            id: 'test-store',
            server: '',
            port: 1433,
            database: 'master',
            user: 'sa',
            password: 'password',
          }),
      ).toThrow(/server must be provided/i);
    });

    it('should throw if database is empty', () => {
      expect(
        () =>
          new MSSQLStore({
            id: 'test-store',
            server: 'localhost',
            port: 1433,
            database: '',
            user: 'sa',
            password: 'password',
          }),
      ).toThrow(/database must be provided/i);
    });

    it('should accept valid server/port config', () => {
      expect(
        () =>
          new MSSQLStore({
            id: 'test-store',
            server: 'localhost',
            port: 1433,
            database: 'master',
            user: 'sa',
            password: 'password',
          }),
      ).not.toThrow();
    });

    it('should accept config with schemaName', () => {
      expect(
        () =>
          new MSSQLStore({
            id: 'test-store',
            server: 'localhost',
            port: 1433,
            database: 'master',
            user: 'sa',
            password: 'password',
            schemaName: 'custom_schema',
          }),
      ).not.toThrow();
    });
  });

  describe('with connection string', () => {
    it('should throw if connectionString is empty', () => {
      expect(
        () =>
          new MSSQLStore({
            id: 'test-store',
            connectionString: '',
          }),
      ).toThrow(/connectionString must be provided/i);
    });

    it('should accept valid connection string', () => {
      expect(
        () =>
          new MSSQLStore({
            id: 'test-store',
            connectionString: CONNECTION_STRING,
          }),
      ).not.toThrow();
    });
  });

  describe('with pre-configured pool', () => {
    it('should accept a ConnectionPool', () => {
      const pool = new sql.ConnectionPool({
        server: 'localhost',
        database: 'master',
        user: 'sa',
        password: 'password',
      });

      expect(
        () =>
          new MSSQLStore({
            id: 'test-store',
            pool,
          }),
      ).not.toThrow();
    });

    it('should accept pool with schemaName', () => {
      const pool = new sql.ConnectionPool({
        server: 'localhost',
        database: 'master',
        user: 'sa',
        password: 'password',
      });

      expect(
        () =>
          new MSSQLStore({
            id: 'test-store',
            pool,
            schemaName: 'custom_schema',
          }),
      ).not.toThrow();
    });

    it('should expose pool as public field', () => {
      const pool = new sql.ConnectionPool({
        server: 'localhost',
        database: 'master',
        user: 'sa',
        password: 'password',
      });

      const store = new MSSQLStore({
        id: 'test-store',
        pool,
      });

      expect(store.pool).toBe(pool);
    });
  });

  describe('disableInit option', () => {
    it('should accept disableInit: true with server config', () => {
      expect(
        () =>
          new MSSQLStore({
            id: 'test-store',
            server: 'localhost',
            port: 1433,
            database: 'master',
            user: 'sa',
            password: 'password',
            disableInit: true,
          }),
      ).not.toThrow();
    });

    it('should accept disableInit: true with pool config', () => {
      const pool = new sql.ConnectionPool({
        server: 'localhost',
        database: 'master',
        user: 'sa',
        password: 'password',
      });

      expect(
        () =>
          new MSSQLStore({
            id: 'test-store',
            pool,
            disableInit: true,
          }),
      ).not.toThrow();
    });
  });
});
