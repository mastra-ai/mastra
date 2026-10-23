import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const inheritedDatabaseSentinel = `file:${join(tmpdir(), `phase001-vitest-inherited-sentinel-${randomUUID()}.db`)}`;
const inheritedLegacyDatabaseSentinel = `file:${join(tmpdir(), `phase001-vitest-inherited-legacy-sentinel-${randomUUID()}.db`)}`;
const databaseIsolationSetup = ['test/support/database-isolation.setup.ts'];
const webResolve = {
  alias: {
    '@': resolve(import.meta.dirname, 'support-demo-ui/src'),
  },
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
          environment: 'node',
          env: {
            TURSO_AUTH_TOKEN: 'phase001-vitest-sentinel-token',
            DATABASE_URL: inheritedDatabaseSentinel,
            TURSO_DATABASE_URL: inheritedLegacyDatabaseSentinel,
          },
          setupFiles: databaseIsolationSetup,
        },
      },
      {
        test: {
          name: 'integration',
          include: ['test/integration/**/*.test.ts'],
          environment: 'node',
          fileParallelism: false,
          env: {
            TURSO_AUTH_TOKEN: 'phase001-vitest-sentinel-token',
            DATABASE_URL: inheritedDatabaseSentinel,
            TURSO_DATABASE_URL: inheritedLegacyDatabaseSentinel,
          },
          setupFiles: databaseIsolationSetup,
        },
      },
      {
        test: {
          name: 'contract',
          include: ['test/contract/**/*.test.ts'],
          environment: 'node',
          env: {
            TURSO_AUTH_TOKEN: 'phase001-vitest-sentinel-token',
            DATABASE_URL: inheritedDatabaseSentinel,
            TURSO_DATABASE_URL: inheritedLegacyDatabaseSentinel,
          },
          setupFiles: databaseIsolationSetup,
        },
      },
      {
        test: {
          name: 'eval',
          include: ['test/eval/**/*.test.ts'],
          environment: 'node',
          env: {
            TURSO_AUTH_TOKEN: 'phase001-vitest-sentinel-token',
            DATABASE_URL: inheritedDatabaseSentinel,
            TURSO_DATABASE_URL: inheritedLegacyDatabaseSentinel,
          },
          setupFiles: databaseIsolationSetup,
        },
      },
      {
        resolve: webResolve,
        test: {
          name: 'web-unit',
          include: ['support-demo-ui/src/**/*.unit.test.{ts,tsx}'],
          environment: 'node',
          env: {
            TURSO_AUTH_TOKEN: 'phase001-vitest-sentinel-token',
            DATABASE_URL: inheritedDatabaseSentinel,
            TURSO_DATABASE_URL: inheritedLegacyDatabaseSentinel,
          },
          setupFiles: databaseIsolationSetup,
        },
      },
      {
        resolve: webResolve,
        test: {
          name: 'web-integration',
          include: ['support-demo-ui/src/**/*.integration.test.{ts,tsx}'],
          environment: 'node',
          env: {
            TURSO_AUTH_TOKEN: 'phase001-vitest-sentinel-token',
            DATABASE_URL: inheritedDatabaseSentinel,
            TURSO_DATABASE_URL: inheritedLegacyDatabaseSentinel,
          },
          setupFiles: databaseIsolationSetup,
        },
      },
      {
        resolve: webResolve,
        test: {
          name: 'web-contract',
          include: ['support-demo-ui/src/**/*.contract.test.{ts,tsx}'],
          environment: 'node',
          env: {
            TURSO_AUTH_TOKEN: 'phase001-vitest-sentinel-token',
            DATABASE_URL: inheritedDatabaseSentinel,
            TURSO_DATABASE_URL: inheritedLegacyDatabaseSentinel,
          },
          setupFiles: databaseIsolationSetup,
        },
      },
      {
        resolve: webResolve,
        test: {
          name: 'web-eval',
          include: ['support-demo-ui/src/**/*.eval.test.{ts,tsx}'],
          environment: 'node',
          env: {
            TURSO_AUTH_TOKEN: 'phase001-vitest-sentinel-token',
            DATABASE_URL: inheritedDatabaseSentinel,
            TURSO_DATABASE_URL: inheritedLegacyDatabaseSentinel,
          },
          setupFiles: databaseIsolationSetup,
        },
      },
    ],
  },
});
