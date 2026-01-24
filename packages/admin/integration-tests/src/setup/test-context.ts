import fs from 'node:fs/promises';
import type { MastraAdmin, AdminStorage } from '@mastra/admin';

/**
 * Test context containing all resources needed for integration tests.
 */
export interface TestContext {
  /** MastraAdmin instance configured for testing */
  admin: MastraAdmin;
  /** Storage provider for direct database access */
  storage: AdminStorage;
  /** Unique schema name for test isolation */
  testSchemaName: string;
  /** Directory for observability test files */
  observabilityDir: string;
  /** Cleanup function to call after tests */
  cleanup: () => Promise<void>;
}

/**
 * Creates a fully configured MastraAdmin instance for integration testing.
 *
 * This function will initialize all necessary providers and create
 * a test-isolated environment with:
 * - Unique database schema per test run
 * - Isolated observability directory
 * - Mock auth provider for testing
 *
 * @returns TestContext with configured admin instance and cleanup function
 *
 * @example
 * ```typescript
 * let ctx: TestContext;
 *
 * beforeAll(async () => {
 *   ctx = await createTestContext();
 * });
 *
 * afterAll(async () => {
 *   await ctx.cleanup();
 * });
 *
 * it('should create a team', async () => {
 *   const team = await ctx.admin.createTeam('user-id', { name: 'Test', slug: 'test' });
 *   expect(team).toBeDefined();
 * });
 * ```
 */
export async function createTestContext(): Promise<TestContext> {
  const testSchemaName = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const observabilityDir = `/tmp/mastra-admin-test-obs-${testSchemaName}`;

  // Create observability directory
  await fs.mkdir(observabilityDir, { recursive: true });

  // NOTE: The actual provider implementations (PostgresAdminStorage, LocalProcessRunner,
  // LocalEdgeRouter, LocalProjectSource, LocalFileStorage, ObservabilityWriter) are
  // defined in separate packages that need to be implemented first:
  // - @mastra/admin-pg (LANE 2)
  // - @mastra/runner-local (LANE 3a)
  // - @mastra/router-local (LANE 3b)
  // - @mastra/source-local (LANE 3c)
  // - @mastra/observability-file-local (LANE 4)
  // - @mastra/observability-writer (LANE 5)
  //
  // Once those packages are implemented, uncomment and use the full implementation below.
  // For now, we create a minimal test context with mock storage.

  // Placeholder: Use MockAdminStorage until actual storage is implemented
  const { MockAdminStorage } = await import('./mock-storage.js');
  const storage = new MockAdminStorage();
  await storage.init();

  // Import MastraAdmin dynamically to avoid issues if package not built
  const { MastraAdmin, NodeCryptoEncryptionProvider } = await import('@mastra/admin');

  // Create MastraAdmin instance with minimal configuration
  const admin = new MastraAdmin({
    licenseKey: 'dev',
    storage,
    encryption: new NodeCryptoEncryptionProvider(
      process.env['ADMIN_ENCRYPTION_SECRET'] ?? 'test-secret-key-32-bytes-long!!!',
    ),
    logger: false, // Disable logging in tests
  });

  // Initialize
  await admin.init();

  const cleanup = async () => {
    try {
      await admin.shutdown();
      await storage.close();

      // Cleanup observability directory
      await fs.rm(observabilityDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  };

  return {
    admin,
    storage,
    testSchemaName,
    observabilityDir,
    cleanup,
  };
}

/**
 * Creates a test context with real PostgreSQL storage.
 *
 * This requires the Docker services to be running and the @mastra/admin-pg
 * package to be implemented.
 *
 * @param connectionString PostgreSQL connection string
 * @returns TestContext with PostgreSQL-backed storage
 */
export async function createTestContextWithPostgres(_connectionString?: string): Promise<TestContext> {
  // TODO: Implement once @mastra/admin-pg is available
  // For now, fall back to mock storage
  return createTestContext();
}
