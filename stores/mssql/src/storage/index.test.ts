import { createTestSuite } from '@internal/storage-test-utils';
import { describe, expect, it, vi } from 'vitest';

import { MSSQLStore } from '.';
import type { MSSQLConfig } from '.';

const TEST_CONFIG: MSSQLConfig = {
  server: process.env.MSSQL_HOST || 'localhost',
  port: Number(process.env.MSSQL_PORT) || 1433,
  database: process.env.MSSQL_DB || 'master',
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || 'Your_password123',
};

// const CONNECTION_STRING = `Server=${TEST_CONFIG.server},${TEST_CONFIG.port};Database=${TEST_CONFIG.database};User Id=${TEST_CONFIG.user};Password=${TEST_CONFIG.password};Encrypt=true;TrustServerCertificate=true`;

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

console.log('Not running MSSQL tests in CI. You can enable them if you want to test them locally.');
if (process.env.ENABLE_TESTS === 'true') {
  createTestSuite(new MSSQLStore(TEST_CONFIG));
} else {
  describe('MSSQLStore', () => {
    it('should be defined', () => {
      expect(MSSQLStore).toBeDefined();
    });
  });
}
