import {
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_AI_SPANS,
} from '@mastra/core/storage';
import { describe, it, expect, afterEach } from 'vitest';
import { PostgresStore } from './index';

describe('PostgresStore tableMap configuration', () => {
  let store: PostgresStore;
  const connectionString = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mastra_test';

  afterEach(async () => {
    if (store) {
      try {
        await store.close();
      } catch {
        // Ignore errors during cleanup
      }
    }
  });

  it('should use custom table names from tableMap', async () => {
    const customTableMap = {
      [TABLE_MESSAGES]: 'custom_messages',
      [TABLE_THREADS]: 'custom_threads',
      [TABLE_RESOURCES]: 'custom_resources',
    };

    store = new PostgresStore({
      connectionString,
      tableMap: customTableMap,
      schemaName: 'test_table_map',
    });

    await store.init();

    // Verify tables were created with custom names
    const tables = await store.db.manyOrNone(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name IN ($2, $3, $4)`,
      ['test_table_map', 'custom_messages', 'custom_threads', 'custom_resources'],
    );

    const tableNames = tables.map((t: any) => t.table_name);
    expect(tableNames).toContain('custom_messages');
    expect(tableNames).toContain('custom_threads');
    expect(tableNames).toContain('custom_resources');
  });

  it('should work with default table names when tableMap is not provided', async () => {
    store = new PostgresStore({
      connectionString,
      schemaName: 'test_default_tables',
    });

    await store.init();

    // Verify default table names
    const tables = await store.db.manyOrNone(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name LIKE 'mastra_%'`,
      ['test_default_tables'],
    );

    const tableNames = tables.map((t: any) => t.table_name);
    expect(tableNames.length).toBeGreaterThan(0);
    expect(tableNames.some((name: string) => name.startsWith('mastra_'))).toBe(true);
  });

  it('should allow partial tableMap (some tables mapped, others default)', async () => {
    const partialTableMap = {
      [TABLE_MESSAGES]: 'chat_messages',
      [TABLE_THREADS]: 'conversations',
    };

    store = new PostgresStore({
      connectionString,
      tableMap: partialTableMap,
      schemaName: 'test_partial_map',
    });

    await store.init();

    // Verify custom and default tables coexist
    const tables = await store.db.manyOrNone(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1`,
      ['test_partial_map'],
    );

    const tableNames = tables.map((t: any) => t.table_name);
    expect(tableNames).toContain('chat_messages');
    expect(tableNames).toContain('conversations');
    // Other tables should use default names
    expect(tableNames).toContain(TABLE_RESOURCES);
  });

  it('should support multi-tenant scenario with different table prefixes', async () => {
    const tenant1Map = {
      [TABLE_TRACES]: 'app_traces',
      [TABLE_AI_SPANS]: 'app_spans',
      [TABLE_SCORERS]: 'app_scores',
    };

    const tenant2Map = {
      [TABLE_TRACES]: 'ml_traces',
      [TABLE_AI_SPANS]: 'ml_spans',
      [TABLE_SCORERS]: 'ml_scores',
    };

    const store1 = new PostgresStore({
      connectionString,
      tableMap: tenant1Map,
      schemaName: 'tenant_app',
    });

    const store2 = new PostgresStore({
      connectionString,
      tableMap: tenant2Map,
      schemaName: 'tenant_ml',
    });

    try {
      await store1.init();
      await store2.init();

      // Verify both tenants have their custom tables
      const tenant1Tables = await store1.db.manyOrNone(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name IN ($2, $3, $4)`,
        ['tenant_app', 'app_traces', 'app_spans', 'app_scores'],
      );

      const tenant2Tables = await store2.db.manyOrNone(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name IN ($2, $3, $4)`,
        ['tenant_ml', 'ml_traces', 'ml_spans', 'ml_scores'],
      );

      expect(tenant1Tables.length).toBe(3);
      expect(tenant2Tables.length).toBe(3);
    } finally {
      await store1.close();
      await store2.close();
    }
  });

  it('should handle SQL injection attempts in table names', async () => {
    const maliciousTableMap = {
      [TABLE_MESSAGES]: "messages'; DROP TABLE users--",
    };

    store = new PostgresStore({
      connectionString,
      tableMap: maliciousTableMap,
      schemaName: 'test_sql_injection',
    });

    // The parseSqlIdentifier should sanitize the table name
    // This test verifies that initialization doesn't execute malicious SQL
    await expect(store.init()).rejects.toThrow();
  });

  it('should work with workflow operations using custom table name', async () => {
    store = new PostgresStore({
      connectionString,
      tableMap: {
        [TABLE_WORKFLOW_SNAPSHOT]: 'workflow_runs',
      },
      schemaName: 'test_workflow_map',
    });

    await store.init();

    const workflowName = 'test_workflow';
    const runId = 'run_123';
    const snapshot = {
      status: 'running',
      results: {},
      suspendedPaths: {},
      waitingPaths: {},
      errors: {},
      stepStack: [],
    };

    await store.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot,
    });

    const loaded = await store.loadWorkflowSnapshot({ workflowName, runId });
    expect(loaded).toEqual(snapshot);
  });

  it('should work with memory operations using custom table names', async () => {
    store = new PostgresStore({
      connectionString,
      tableMap: {
        [TABLE_MESSAGES]: 'chat',
        [TABLE_THREADS]: 'conversation',
        [TABLE_RESOURCES]: 'user',
      },
      schemaName: 'test_memory_map',
    });

    await store.init();

    const resourceId = 'user_123';
    const threadId = 'thread_456';

    // Create resource
    await store.saveResource({
      resource: {
        id: resourceId,
        workingMemory: 'test memory',
        metadata: { name: 'Test User' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create thread
    const thread = await store.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Test Thread',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(thread.id).toBe(threadId);
    expect(thread.resourceId).toBe(resourceId);

    // Save messages
    const messages = await store.saveMessages({
      messages: [
        {
          id: 'msg_1',
          threadId,
          resourceId,
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
        },
      ],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello');
  });
});
