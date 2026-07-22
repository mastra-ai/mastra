import { createSampleMessageV2, createSampleThread } from '@internal/storage-test-utils';
import type { MemoryStorage, StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PostgresStoreConfig } from '../shared/config';
import { PgDB } from './db';
import { MemoryPG } from './domains/memory';
import { exportSchemas, PostgresStore } from '.';

export const TEST_CONFIG: PostgresStoreConfig = {
  id: 'test-postgres-store',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5434,
  database: process.env.POSTGRES_DB || 'postgres',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
} as PostgresStoreConfig;

export const connectionString = `postgresql://${(TEST_CONFIG as any).user}:${(TEST_CONFIG as any).password}@${(TEST_CONFIG as any).host}:${(TEST_CONFIG as any).port}/${(TEST_CONFIG as any).database}`;

export function pgTests() {
  let store: PostgresStore;
  let dbOps: PgDB;

  describe('PG specific tests', () => {
    beforeAll(async () => {
      store = new PostgresStore(TEST_CONFIG);
      await store.init();
      // Create PgDB instance for low-level operations
      dbOps = new PgDB({ client: store.db });
    });
    afterAll(async () => {
      try {
        await store.close();
      } catch {}
    });

    describe('Public Fields Access', () => {
      it('should expose client field as public', () => {
        expect(store.db).toBeDefined();
        expect(typeof store.db).toBe('object');
        expect(store.db.query).toBeDefined();
        expect(typeof store.db.query).toBe('function');
      });

      it('should expose pool field as public', () => {
        expect(store.pool).toBeDefined();
        expect(store.pool).toBeInstanceOf(Pool);
      });

      it('should allow direct database queries via public client field', async () => {
        const result = await store.db.one<{ test: number }>('SELECT 1 as test');
        expect(result.test).toBe(1);
      });

      it('should maintain connection state through public client field', async () => {
        // Test multiple queries to ensure connection state
        const result1 = await store.db.one<{ timestamp1: Date }>('SELECT NOW() as timestamp1');
        const result2 = await store.db.one<{ timestamp2: Date }>('SELECT NOW() as timestamp2');

        expect(result1.timestamp1).toBeDefined();
        expect(result2.timestamp2).toBeDefined();
        expect(new Date(result2.timestamp2).getTime()).toBeGreaterThanOrEqual(new Date(result1.timestamp1).getTime());
      });

      it('should throw error when pool is used after disconnect', async () => {
        await store.close();
        await expect(store.db.connect()).rejects.toThrow();
        store = new PostgresStore(TEST_CONFIG);
        await store.init();
        // Recreate dbOps with new store connection
        dbOps = new PgDB({ client: store.db });
      });
    });

    describe('Memory saveMessages batching', () => {
      it('should save a message batch larger than one PostgreSQL bind-parameter chunk', async () => {
        const memory = (await store.getStore('memory'))!;
        const thread = createSampleThread({
          id: `batch-thread-${Date.now()}`,
          resourceId: `batch-resource-${Date.now()}`,
        });
        await memory.saveThread({ thread });

        const messages = Array.from({ length: 8192 }, (_, index) =>
          createSampleMessageV2({
            threadId: thread.id,
            resourceId: thread.resourceId,
            content: { content: `Batch message ${index}` },
            createdAt: new Date(Date.now() + index),
          }),
        );

        const { messages: savedMessages } = await memory.saveMessages({ messages });
        expect(savedMessages).toHaveLength(8192);

        const row = await store.db.one<{ count: string }>(
          'SELECT COUNT(*)::text AS count FROM mastra_messages WHERE thread_id = $1',
          [thread.id],
        );
        expect(Number(row.count)).toBe(8192);
      });
    });

    describe('PgStorage Table Name Quoting', () => {
      const camelCaseTable = 'TestCamelCaseTable';
      const snakeCaseTable = 'test_snake_case_table';
      const BASE_SCHEMA = {
        id: { type: 'integer', primaryKey: true, nullable: false },
        name: { type: 'text', nullable: true },
        createdAt: { type: 'timestamp', nullable: false },
        updatedAt: { type: 'timestamp', nullable: false },
      } as Record<string, StorageColumn>;

      beforeEach(async () => {
        // Only clear tables if store is initialized
        try {
          // Clear tables before each test
          await dbOps.clearTable({ tableName: camelCaseTable as TABLE_NAMES });
          await dbOps.clearTable({ tableName: snakeCaseTable as TABLE_NAMES });
        } catch (error) {
          // Ignore errors during table clearing
          console.warn('Error clearing tables:', error);
        }
      });

      afterEach(async () => {
        // Only clear tables if store is initialized
        try {
          // Clear tables before each test
          await dbOps.clearTable({ tableName: camelCaseTable as TABLE_NAMES });
          await dbOps.clearTable({ tableName: snakeCaseTable as TABLE_NAMES });
        } catch (error) {
          // Ignore errors during table clearing
          console.warn('Error clearing tables:', error);
        }
      });

      it('should create and upsert to a camelCase table without quoting errors', async () => {
        await expect(
          dbOps.createTable({
            tableName: camelCaseTable as TABLE_NAMES,
            schema: BASE_SCHEMA,
          }),
        ).resolves.not.toThrow();

        await dbOps.insert({
          tableName: camelCaseTable as TABLE_NAMES,
          record: { id: '1', name: 'Alice', createdAt: new Date(), updatedAt: new Date() },
        });

        const row: any = await dbOps.load({
          tableName: camelCaseTable as TABLE_NAMES,
          keys: { id: '1' },
        });
        expect(row?.name).toBe('Alice');
      });

      it('should create and upsert to a snake_case table without quoting errors', async () => {
        await expect(
          dbOps.createTable({
            tableName: snakeCaseTable as TABLE_NAMES,
            schema: BASE_SCHEMA,
          }),
        ).resolves.not.toThrow();

        await dbOps.insert({
          tableName: snakeCaseTable as TABLE_NAMES,
          record: { id: '2', name: 'Bob', createdAt: new Date(), updatedAt: new Date() },
        });

        const row: any = await dbOps.load({
          tableName: snakeCaseTable as TABLE_NAMES,
          keys: { id: '2' },
        });
        expect(row?.name).toBe('Bob');
      });
    });

    describe('Permission Handling', () => {
      const schemaRestrictedUser = 'mastra_schema_restricted_storage';
      const restrictedPassword = 'test123';
      const testSchema = 'testSchema';
      let adminPool: Pool;

      beforeAll(async () => {
        // Re-initialize the main store for subsequent tests
        await store.init();

        // Create a separate pool for admin operations
        adminPool = new Pool({ connectionString });
        const client = await adminPool.connect();
        try {
          // Drop the test schema if it exists from previous runs
          await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);

          // Create schema restricted user with minimal permissions
          await client.query(`
                DO $$
                BEGIN
                  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${schemaRestrictedUser}') THEN
                    CREATE USER ${schemaRestrictedUser} WITH PASSWORD '${restrictedPassword}' NOCREATEDB;
                  END IF;
                END
                $$;`);

          // Grant only connect and usage to schema restricted user
          await client.query(`
                  REVOKE ALL ON DATABASE ${(TEST_CONFIG as any).database} FROM ${schemaRestrictedUser};
                  GRANT CONNECT ON DATABASE ${(TEST_CONFIG as any).database} TO ${schemaRestrictedUser};
                  REVOKE ALL ON SCHEMA public FROM ${schemaRestrictedUser};
                  GRANT USAGE ON SCHEMA public TO ${schemaRestrictedUser};
                `);
        } finally {
          client.release();
        }
      });

      afterAll(async () => {
        const client = await adminPool.connect();
        try {
          await client.query(`
                  REASSIGN OWNED BY ${schemaRestrictedUser} TO postgres;
                  DROP OWNED BY ${schemaRestrictedUser};
                  DROP USER IF EXISTS ${schemaRestrictedUser};
                `);
        } finally {
          client.release();
          await adminPool.end();
        }
      });

      describe('Schema Creation', () => {
        beforeEach(async () => {
          const client = await adminPool.connect();
          try {
            // Ensure schema doesn't exist before each test
            await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);

            // Ensure no active connections from restricted user
            await client.query(`
                  SELECT pg_terminate_backend(pid)
                  FROM pg_stat_activity
                  WHERE usename = '${schemaRestrictedUser}'
                `);
          } finally {
            client.release();
          }
        });

        afterEach(async () => {
          const client = await adminPool.connect();
          try {
            // Clean up any connections from the restricted user and drop schema
            await client.query(`
                  DO $$
                  BEGIN
                    -- Terminate connections
                    PERFORM pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE usename = '${schemaRestrictedUser}';

                    -- Drop schema
                    DROP SCHEMA IF EXISTS ${testSchema} CASCADE;
                  END $$;
                `);
          } finally {
            client.release();
          }
        });

        it('should fail when user lacks CREATE privilege', async () => {
          const restrictedDB = new PostgresStore({
            ...TEST_CONFIG,
            id: 'restricted-db-no-create',
            user: schemaRestrictedUser,
            password: restrictedPassword,
            schemaName: testSchema,
          });

          try {
            // Test schema creation by initializing the store
            await expect(async () => {
              await restrictedDB.init();
            }).rejects.toThrow(
              `Unable to create schema "${testSchema}". This requires CREATE privilege on the database.`,
            );

            // Verify schema was not created
            const result = await adminPool.query(
              `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)`,
              [testSchema],
            );
            expect(result.rows[0]?.exists).toBe(false);
          } finally {
            await restrictedDB.close();
          }
        });

        it('should fail with schema creation error when saving thread', async () => {
          const restrictedDB = new PostgresStore({
            ...TEST_CONFIG,
            id: 'restricted-db-thread',
            user: schemaRestrictedUser,
            password: restrictedPassword,
            schemaName: testSchema,
          });

          try {
            await expect(async () => {
              await restrictedDB.init();
              const memory = await restrictedDB.getStore('memory');
              const thread = createSampleThread();
              await memory!.saveThread({ thread });
            }).rejects.toThrow(
              `Unable to create schema "${testSchema}". This requires CREATE privilege on the database.`,
            );

            // Verify schema was not created
            const result = await adminPool.query(
              `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)`,
              [testSchema],
            );
            expect(result.rows[0]?.exists).toBe(false);
          } finally {
            await restrictedDB.close();
          }
        });
      });
    });

    describe('Function Namespace in Schema', () => {
      const testSchema = 'schema_fn_test';
      let testStore: PostgresStore;
      let adminPool: Pool;

      beforeAll(async () => {
        // Use a temp pool to set up schema
        adminPool = new Pool({ connectionString });
        const client = await adminPool.connect();

        try {
          await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
          await client.query(`CREATE SCHEMA ${testSchema}`);
          // Drop the function from public schema if it exists from other tests
          await client.query(`DROP FUNCTION IF EXISTS public.trigger_set_timestamps() CASCADE`);
        } finally {
          client.release();
        }

        testStore = new PostgresStore({
          ...TEST_CONFIG,
          id: 'schema-fn-test-store',
          schemaName: testSchema,
        });
        await testStore.init();
      });

      afterAll(async () => {
        await testStore?.close();

        const client = await adminPool.connect();
        try {
          await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
        } finally {
          client.release();
          await adminPool.end();
        }
      });

      it('should create trigger function in the correct schema namespace', async () => {
        const SpansSchema = {
          id: { type: 'text', primaryKey: true, nullable: false },
          name: { type: 'text', nullable: true },
          createdAt: { type: 'timestamp', nullable: false },
          updatedAt: { type: 'timestamp', nullable: false },
        } as Record<string, StorageColumn>;

        // Create PgDB instance for low-level operations
        const testDbOps = new PgDB({ client: testStore.db, schemaName: testSchema });
        await testDbOps.createTable({
          tableName: 'mastra_ai_spans' as TABLE_NAMES,
          schema: SpansSchema,
        });

        // Verify trigger function exists in the correct schema
        const functionInfo = await testStore.db.oneOrNone<{ proname: string; nspname: string }>(
          `SELECT p.proname, n.nspname
           FROM pg_proc p
           JOIN pg_namespace n ON p.pronamespace = n.oid
           WHERE n.nspname = $1 AND p.proname = 'trigger_set_timestamps'`,
          [testSchema],
        );

        expect(functionInfo).toBeDefined();
        expect(functionInfo?.proname).toBe('trigger_set_timestamps');
        expect(functionInfo?.nspname).toBe(testSchema);

        // Verify function does NOT exist in public schema
        const publicFunction = await testStore.db.oneOrNone(
          `SELECT p.proname, n.nspname
           FROM pg_proc p
           JOIN pg_namespace n ON p.pronamespace = n.oid
           WHERE n.nspname = 'public' AND p.proname = 'trigger_set_timestamps'`,
        );

        expect(publicFunction).toBeNull();
      });
    });

    describe('Timestamp Fallback Handling', () => {
      let testThreadId: string;
      let testResourceId: string;
      let testMessageId: string;
      let memory: MemoryStorage;

      beforeAll(async () => {
        store = new PostgresStore(TEST_CONFIG);
        await store.init();
        memory = (await store.getStore('memory'))!;
      });
      afterAll(async () => {
        try {
          await store.close();
        } catch {}
      });

      beforeEach(async () => {
        testThreadId = `thread-${Date.now()}`;
        testResourceId = `resource-${Date.now()}`;
        testMessageId = `msg-${Date.now()}`;
      });

      it('should use createdAtZ over createdAt for messages when both exist', async () => {
        // Create a thread first
        const thread = createSampleThread({ id: testThreadId, resourceId: testResourceId });
        await memory.saveThread({ thread });

        // Directly insert a message with both createdAt and createdAtZ where they differ
        const createdAtValue = new Date('2024-01-01T10:00:00Z');
        const createdAtZValue = new Date('2024-01-01T15:00:00Z'); // 5 hours later - clearly different

        await store.db.none(
          `INSERT INTO mastra_messages (id, thread_id, content, role, type, "resourceId", "createdAt", "createdAtZ")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [testMessageId, testThreadId, 'Test message', 'user', 'v2', testResourceId, createdAtValue, createdAtZValue],
        );

        // Test listMessagesById
        const messagesByIdResult = await memory.listMessagesById({ messageIds: [testMessageId] });
        expect(messagesByIdResult.messages.length).toBe(1);
        expect(messagesByIdResult.messages[0]?.createdAt).toBeInstanceOf(Date);
        expect(messagesByIdResult.messages[0]?.createdAt.getTime()).toBe(createdAtZValue.getTime());
        expect(messagesByIdResult.messages[0]?.createdAt.getTime()).not.toBe(createdAtValue.getTime());

        // Test listMessages
        const messagesResult = await memory.listMessages({
          threadId: testThreadId,
        });
        expect(messagesResult.messages.length).toBe(1);
        expect(messagesResult.messages[0]?.createdAt).toBeInstanceOf(Date);
        expect(messagesResult.messages[0]?.createdAt.getTime()).toBe(createdAtZValue.getTime());
        expect(messagesResult.messages[0]?.createdAt.getTime()).not.toBe(createdAtValue.getTime());
      });

      it('should fallback to createdAt when createdAtZ is null for legacy messages', async () => {
        // Create a thread first
        const thread = createSampleThread({ id: testThreadId, resourceId: testResourceId });
        await memory.saveThread({ thread });

        // Directly insert a message with only createdAt (simulating old records)
        const createdAtValue = new Date('2024-01-01T10:00:00Z');

        await store.db.none(
          `INSERT INTO mastra_messages (id, thread_id, content, role, type, "resourceId", "createdAt", "createdAtZ")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`,
          [testMessageId, testThreadId, 'Legacy message', 'user', 'v2', testResourceId, createdAtValue],
        );

        // Test listMessagesById
        const messagesByIdResult = await memory.listMessagesById({ messageIds: [testMessageId] });
        expect(messagesByIdResult.messages.length).toBe(1);
        expect(messagesByIdResult.messages[0]?.createdAt).toBeInstanceOf(Date);
        expect(messagesByIdResult.messages[0]?.createdAt.getTime()).toBe(createdAtValue.getTime());

        // Test listMessages
        const messagesResult = await memory.listMessages({
          threadId: testThreadId,
        });
        expect(messagesResult.messages.length).toBe(1);
        expect(messagesResult.messages[0]?.createdAt).toBeInstanceOf(Date);
        expect(messagesResult.messages[0]?.createdAt.getTime()).toBe(createdAtValue.getTime());
      });

      it('should have consistent timestamp handling between threads and messages', async () => {
        // Create a thread first with a known createdAt timestamp
        const threadCreatedAt = new Date('2024-01-01T10:00:00Z');
        const thread = createSampleThread({ id: testThreadId, resourceId: testResourceId });
        thread.createdAt = threadCreatedAt;
        await memory.saveThread({ thread });

        // Save a message through the normal API with a different timestamp
        const messageCreatedAt = new Date('2024-01-01T12:00:00Z');
        await memory.saveMessages({
          messages: [
            {
              id: testMessageId,
              threadId: testThreadId,
              resourceId: testResourceId,
              role: 'user',
              content: { format: 2, parts: [{ type: 'text', text: 'Test' }], content: 'Test' },
              createdAt: messageCreatedAt,
            },
          ],
        });

        // Get thread
        const retrievedThread = await memory.getThreadById({ threadId: testThreadId });
        expect(retrievedThread).toBeTruthy();
        expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
        expect(retrievedThread?.createdAt.getTime()).toBe(threadCreatedAt.getTime());

        // Get messages
        const messagesResult = await memory.listMessages({ threadId: testThreadId });
        expect(messagesResult.messages.length).toBe(1);
        expect(messagesResult.messages[0]?.createdAt).toBeInstanceOf(Date);
        expect(messagesResult.messages[0]?.createdAt.getTime()).toBe(messageCreatedAt.getTime());
      });

      it('should handle included messages with correct timestamp fallback', async () => {
        // Create a thread
        const thread = createSampleThread({ id: testThreadId, resourceId: testResourceId });
        await memory.saveThread({ thread });

        // Create multiple messages
        const msg1Id = `${testMessageId}-1`;
        const msg2Id = `${testMessageId}-2`;
        const msg3Id = `${testMessageId}-3`;

        const date1 = new Date('2024-01-01T10:00:00Z');
        const date2 = new Date('2024-01-01T11:00:00Z');
        const date2Z = new Date('2024-01-01T16:00:00Z'); // Different from date2
        const date3 = new Date('2024-01-01T12:00:00Z');

        // Insert messages with different createdAt/createdAtZ combinations
        // msg1: has createdAtZ (should use it)
        await store.db.none(
          `INSERT INTO mastra_messages (id, thread_id, content, role, type, "resourceId", "createdAt", "createdAtZ")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [msg1Id, testThreadId, 'Message 1', 'user', 'v2', testResourceId, date1, date1],
        );

        // msg2: has NULL createdAtZ (should fallback to createdAt)
        await store.db.none(
          `INSERT INTO mastra_messages (id, thread_id, content, role, type, "resourceId", "createdAt", "createdAtZ")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`,
          [msg2Id, testThreadId, 'Message 2', 'assistant', 'v2', testResourceId, date2],
        );

        // msg3: has both createdAt and createdAtZ with different values (should use createdAtZ)
        await store.db.none(
          `INSERT INTO mastra_messages (id, thread_id, content, role, type, "resourceId", "createdAt", "createdAtZ")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [msg3Id, testThreadId, 'Message 3', 'user', 'v2', testResourceId, date3, date2Z],
        );

        // Test listMessages with include
        const messagesResult = await memory.listMessages({
          threadId: testThreadId,
          include: [
            {
              id: msg2Id,
              withPreviousMessages: 1,
              withNextMessages: 1,
            },
          ],
        });

        expect(messagesResult.messages.length).toBe(3);

        // Find each message and verify correct timestamps
        const message1 = messagesResult.messages.find((m: any) => m.id === msg1Id);
        expect(message1).toBeDefined();
        expect(message1?.createdAt).toBeInstanceOf(Date);
        expect(message1?.createdAt.getTime()).toBe(date1.getTime());

        const message2 = messagesResult.messages.find((m: any) => m.id === msg2Id);
        expect(message2).toBeDefined();
        expect(message2?.createdAt).toBeInstanceOf(Date);
        expect(message2?.createdAt.getTime()).toBe(date2.getTime());

        const message3 = messagesResult.messages.find((m: any) => m.id === msg3Id);
        expect(message3).toBeDefined();
        expect(message3?.createdAt).toBeInstanceOf(Date);
        // Should use createdAtZ (date2Z), not createdAt (date3)
        expect(message3?.createdAt.getTime()).toBe(date2Z.getTime());
        expect(message3?.createdAt.getTime()).not.toBe(date3.getTime());
      });
    });

    // PG-specific: Cloud SQL Connector configuration tests (not covered by factory)
    describe('Cloud SQL Connector Config', () => {
      it('accepts config with stream property (Cloud SQL connector)', () => {
        const connectorConfig = {
          id: 'cloud-sql-connector-store',
          user: 'test-user',
          database: 'test-db',
          ssl: { rejectUnauthorized: false },
          stream: () => ({}), // Mock stream function
        };
        expect(() => new PostgresStore(connectorConfig as any)).not.toThrow();
      });

      it('accepts config with password function (IAM auth)', () => {
        const iamConfig = {
          id: 'iam-auth-store',
          user: 'test-user',
          database: 'test-db',
          host: 'localhost', // This could be present but ignored when password is a function
          port: 5432,
          password: () => Promise.resolve('dynamic-token'), // Mock password function
          ssl: { rejectUnauthorized: false },
        };
        expect(() => new PostgresStore(iamConfig as any)).not.toThrow();
      });

      it('accepts generic pg ClientConfig', () => {
        const clientConfig = {
          id: 'generic-client-config-store',
          user: 'test-user',
          database: 'test-db',
          application_name: 'test-app',
          ssl: { rejectUnauthorized: false },
          stream: () => ({}), // Mock stream
        };
        expect(() => new PostgresStore(clientConfig as any)).not.toThrow();
      });
    });

    // PG-specific: pool field exposure with pre-configured pool
    describe('Pre-configured Pool Field Exposure', () => {
      it('should expose client and pool fields with pre-configured pool', async () => {
        const pool = new Pool({ connectionString });

        const poolStore = new PostgresStore({
          id: 'pre-configured-pool-fields-store',
          pool,
        });

        // pool should be the same pool we passed in
        expect(poolStore.pool).toBe(pool);
        // db should be defined
        expect(poolStore.db).toBeDefined();

        // Clean up
        await pool.end();
      });
    });

    // PG-specific: Domain schemaName verification with pre-configured pool
    describe('Domain schemaName with Pre-configured Pool', () => {
      it('should allow domains to use custom schemaName with pre-configured pool', async () => {
        const pool = new Pool({ connectionString });

        // Create schema for test
        await pool.query('CREATE SCHEMA IF NOT EXISTS domain_test_schema');

        try {
          const memoryDomain = new MemoryPG({
            pool,
            schemaName: 'domain_test_schema',
          });

          expect(memoryDomain).toBeDefined();
          await memoryDomain.init();

          // Verify tables were created in the custom schema
          const result = await pool.query(
            `SELECT EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'domain_test_schema'
              AND table_name = 'mastra_threads'
            )`,
          );
          expect(result.rows[0]?.exists).toBe(true);
        } finally {
          // Clean up
          await pool.query('DROP SCHEMA IF EXISTS domain_test_schema CASCADE');
          await pool.end();
        }
      });
    });

    describe('Schema Export', () => {
      it('should export schema for public schema', () => {
        const schema = exportSchemas();

        expect(schema).toContain('CREATE TABLE IF NOT EXISTS');
        expect(schema).toContain('mastra_threads');
        expect(schema).toContain('mastra_messages');
        expect(schema).toContain('mastra_workflow_snapshot');
        expect(schema).toContain('mastra_scorers');
        expect(schema).toContain('mastra_ai_spans');
        expect(schema).toContain('mastra_resources');
        expect(schema).toContain('mastra_agents');
        expect(schema).toContain('mastra_observational_memory');
      });

      it('should export schema with custom schema name', () => {
        const schema = exportSchemas('my_custom_schema');

        expect(schema).toContain('CREATE SCHEMA IF NOT EXISTS "my_custom_schema"');
        expect(schema).toContain('"my_custom_schema"."mastra_threads"');
        expect(schema).toContain('"my_custom_schema"."mastra_messages"');

        // Verify constraint names include the schema prefix (truncated to 63 bytes for PG limit)
        expect(schema).toContain('my_custom_schema_mastra_workflow_snapshot_workflow_name_run_id_');
        expect(schema).toContain('my_custom_schema_mastra_ai_spans_traceid_spanid_pk');
      });

      it('should generate SQL with correct constraints', () => {
        const schema = exportSchemas();

        expect(schema).toContain('createdAtZ" TIMESTAMPTZ DEFAULT NOW()');
        expect(schema).toContain('updatedAtZ" TIMESTAMPTZ DEFAULT NOW()');
        expect(schema).toContain('mastra_workflow_snapshot_workflow_name_run_id_key');
        expect(schema).toContain('UNIQUE (workflow_name, run_id)');
        expect(schema).toContain('mastra_ai_spans_traceid_spanid_pk');
        expect(schema).toContain('PRIMARY KEY ("traceId", "spanId")');
      });

      it('should reject invalid schema names', () => {
        // Schema names with special characters should throw an error
        expect(() => exportSchemas('my-schema')).toThrow('Invalid schema name');
        expect(() => exportSchemas('123schema')).toThrow('Invalid schema name');
        expect(() => exportSchemas('schema with spaces')).toThrow('Invalid schema name');
      });

      it('should accept valid schema names with underscores', () => {
        const schema = exportSchemas('my_schema');

        // Valid schema name should work
        expect(schema).toContain('"my_schema"."mastra_threads"');
        expect(schema).toContain('my_schema_mastra_workflow_snapshot_workflow_name_run_id_key');
        expect(schema).toContain('my_schema_mastra_ai_spans_traceid_spanid_pk');
      });

      it('should export default indexes for public schema', () => {
        const schema = exportSchemas();

        // Memory domain indexes
        expect(schema).toContain('CREATE INDEX IF NOT EXISTS "mastra_threads_resourceid_createdat_idx"');
        expect(schema).toContain('CREATE INDEX IF NOT EXISTS "mastra_messages_thread_id_createdat_idx"');

        // Observability domain indexes
        expect(schema).toContain('CREATE INDEX IF NOT EXISTS "mastra_ai_spans_traceid_startedat_idx"');
        expect(schema).toContain('CREATE INDEX IF NOT EXISTS "mastra_ai_spans_parentspanid_startedat_idx"');
        expect(schema).toContain('CREATE INDEX IF NOT EXISTS "mastra_ai_spans_name_idx"');
        expect(schema).toContain('CREATE INDEX IF NOT EXISTS "mastra_ai_spans_spantype_startedat_idx"');
        expect(schema).toContain('CREATE INDEX IF NOT EXISTS "mastra_ai_spans_root_spans_idx"');
        expect(schema).toContain('WHERE "parentSpanId" IS NULL');
        expect(schema).toContain('CREATE INDEX IF NOT EXISTS "mastra_ai_spans_entitytype_entityid_idx"');
        expect(schema).toContain('CREATE INDEX IF NOT EXISTS "mastra_ai_spans_entitytype_entityname_idx"');
        expect(schema).toContain('CREATE INDEX IF NOT EXISTS "mastra_ai_spans_orgid_userid_idx"');
        expect(schema).toContain(
          'CREATE INDEX IF NOT EXISTS "mastra_ai_spans_metadata_gin_idx" ON "public"."mastra_ai_spans" USING gin',
        );
        expect(schema).toContain(
          'CREATE INDEX IF NOT EXISTS "mastra_ai_spans_tags_gin_idx" ON "public"."mastra_ai_spans" USING gin',
        );

        // Scores domain indexes
        expect(schema).toContain('CREATE INDEX IF NOT EXISTS "mastra_scores_trace_id_span_id_created_at_idx"');

        // Scorer definitions domain indexes
        expect(schema).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "idx_scorer_definition_versions_def_version"');

        // Prompt blocks domain indexes
        expect(schema).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "idx_prompt_block_versions_block_version"');
      });

      it('should export indexes with schema prefix for custom schema', () => {
        const schema = exportSchemas('my_schema');

        // Index names should have the schema prefix
        expect(schema).toContain('CREATE INDEX IF NOT EXISTS "my_schema_mastra_threads_resourceid_createdat_idx"');
        expect(schema).toContain('CREATE INDEX IF NOT EXISTS "my_schema_mastra_ai_spans_traceid_startedat_idx"');
        expect(schema).toContain(
          'CREATE INDEX IF NOT EXISTS "my_schema_mastra_scores_trace_id_span_id_created_at_idx"',
        );
        expect(schema).toContain(
          'CREATE UNIQUE INDEX IF NOT EXISTS "my_schema_idx_scorer_definition_versions_def_version"',
        );
        expect(schema).toContain(
          'CREATE UNIQUE INDEX IF NOT EXISTS "my_schema_idx_prompt_block_versions_block_version"',
        );

        // Index table references should use the schema-qualified table name
        expect(schema).toContain('ON "my_schema"."mastra_threads"');
        expect(schema).toContain('ON "my_schema"."mastra_ai_spans"');
      });

      it('should export timestamp trigger for spans table', () => {
        const schema = exportSchemas();

        // Trigger function
        expect(schema).toContain('CREATE OR REPLACE FUNCTION "public".trigger_set_timestamps()');
        expect(schema).toContain('RETURNS TRIGGER');
        expect(schema).toContain('LANGUAGE plpgsql');

        // Trigger itself
        expect(schema).toContain('CREATE TRIGGER "mastra_ai_spans_timestamps"');
        expect(schema).toContain('BEFORE INSERT OR UPDATE ON "public"."mastra_ai_spans"');
        expect(schema).toContain('EXECUTE FUNCTION "public".trigger_set_timestamps()');
      });

      it('should export timestamp trigger with custom schema', () => {
        const schema = exportSchemas('my_schema');

        expect(schema).toContain('CREATE OR REPLACE FUNCTION "my_schema".trigger_set_timestamps()');
        expect(schema).toContain('BEFORE INSERT OR UPDATE ON "my_schema"."mastra_ai_spans"');
        expect(schema).toContain('EXECUTE FUNCTION "my_schema".trigger_set_timestamps()');
      });

      it('should export observational memory table and index', () => {
        const schema = exportSchemas();

        // OM table
        expect(schema).toContain('mastra_observational_memory');
        expect(schema).toContain('"lookupKey"');
        expect(schema).toContain('"activeObservations"');

        // OM lookup key index
        expect(schema).toContain(
          'CREATE INDEX IF NOT EXISTS "idx_om_lookup_key" ON "public"."mastra_observational_memory" ("lookupKey")',
        );
      });

      it('should export observational memory table with custom schema', () => {
        const schema = exportSchemas('my_schema');

        expect(schema).toContain('"my_schema"."mastra_observational_memory"');
        expect(schema).toContain(
          'CREATE INDEX IF NOT EXISTS "my_schema_idx_om_lookup_key" ON "my_schema"."mastra_observational_memory" ("lookupKey")',
        );
      });

      it('should apply the full exported schema as a single multi-statement query', async () => {
        const pool = new Pool({ connectionString });

        try {
          await pool.query('DROP SCHEMA IF EXISTS export_apply CASCADE');
          // Fails with a syntax error if any statement boundary is missing a semicolon
          await pool.query(exportSchemas('export_apply'));

          const result = await pool.query(
            `SELECT EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'export_apply'
              AND table_name = 'mastra_favorites'
            )`,
          );
          expect(result.rows[0]?.exists).toBe(true);
        } finally {
          await pool.query('DROP SCHEMA IF EXISTS export_apply CASCADE');
          await pool.end();
        }
      });
    });

    // PG-specific: Unicode escape sequence handling in workflow snapshots
    // See: https://github.com/mastra-ai/mastra/issues/11563
    describe('Unicode Escape Sequence Handling', () => {
      let unicodeStore: PostgresStore;
      let workflowsStorage: any;

      beforeAll(async () => {
        // Create a dedicated store for these tests to avoid pool lifecycle issues
        // with other tests that close/reopen the main store
        unicodeStore = new PostgresStore({ ...TEST_CONFIG, id: 'unicode-test-store' });
        await unicodeStore.init();
        workflowsStorage = await unicodeStore.getStore('workflows');
      });

      afterAll(async () => {
        try {
          await unicodeStore.close();
        } catch {}
      });

      beforeEach(async () => {
        await workflowsStorage.dangerouslyClearAll();
      });

      it('should handle null characters in snapshot when filtering by status', async () => {
        // Test for GitHub issue #11563: "Unsupported unicode escape sequence" when listing messages
        // PostgreSQL's jsonb cast fails on null characters (\u0000) with error 22P05
        const workflowName = 'unicode_null_test';
        const runId = `run-${Date.now()}`;

        const snapshotWithNull = {
          runId,
          status: 'success',
          value: {},
          context: {},
          activePaths: [],
          activeStepsPath: {},
          suspendedPaths: {},
          resumeLabels: {},
          serializedStepGraph: [],
          waitingPaths: {},
          timestamp: Date.now(),
          userMessage: 'Ótimo, já entendi! Vamos lá então.',
          problematicContent: 'Text with null char: \u0000 and accented: áéíóú',
        };

        await workflowsStorage.persistWorkflowSnapshot({
          workflowName,
          runId,
          snapshot: snapshotWithNull,
        });

        // This should NOT throw "unsupported Unicode escape sequence" error
        const { runs } = await workflowsStorage.listWorkflowRuns({ status: 'success' });

        expect(runs.length).toBeGreaterThanOrEqual(1);
        const foundRun = runs.find((r: any) => r.workflowName === workflowName);
        expect(foundRun).toBeDefined();
        expect(foundRun.snapshot.userMessage).toBe('Ótimo, já entendi! Vamos lá então.');
        // Verify the null character is sanitized (removed) to allow jsonb storage
        // PostgreSQL jsonb type does not support null characters, so they are stripped during insertion
        expect(foundRun.snapshot.problematicContent).toBe('Text with null char:  and accented: áéíóú');
        expect(foundRun.snapshot.problematicContent.includes('\u0000')).toBe(false);
      });

      it('should handle unpaired Unicode surrogates in snapshot when filtering by status', async () => {
        // PostgreSQL's jsonb cast fails on unpaired surrogates (\uD800-\uDFFF)
        const workflowName = 'unicode_surrogate_test';
        const runId = `run-${Date.now()}`;

        const snapshotWithSurrogate = {
          runId,
          status: 'failed',
          value: {},
          context: {},
          activePaths: [],
          activeStepsPath: {},
          suspendedPaths: {},
          resumeLabels: {},
          serializedStepGraph: [],
          waitingPaths: {},
          timestamp: Date.now(),
          problematicHigh: 'Text with high surrogate: \ud800 here',
          problematicLow: 'Text with low surrogate: \udc00 here',
        };

        await workflowsStorage.persistWorkflowSnapshot({
          workflowName,
          runId,
          snapshot: snapshotWithSurrogate,
        });

        // This should NOT throw "Unicode low surrogate must follow a high surrogate" error
        const { runs } = await workflowsStorage.listWorkflowRuns({ status: 'failed' });

        expect(runs.length).toBeGreaterThanOrEqual(1);
        const foundRun = runs.find((r: any) => r.workflowName === workflowName);
        expect(foundRun).toBeDefined();
      });
    });

    // PG-specific: AgentsPG resilience to jsonb scalar string rows
    // See: https://github.com/mastra-ai/mastra/issues/16224
    describe('AgentsPG jsonb scalar string resilience (#16224)', () => {
      let agentsStore: any;
      let agentsTestStore: PostgresStore;

      beforeAll(async () => {
        agentsTestStore = new PostgresStore({ ...TEST_CONFIG, id: 'agents-jsonb-scalar-test' });
        await agentsTestStore.init();
        agentsStore = await agentsTestStore.getStore('agents');
      });

      afterAll(async () => {
        try {
          await agentsTestStore.close();
        } catch {}
      });

      beforeEach(async () => {
        // Wipe both tables — versions first because of the FK direction
        await agentsTestStore.db.none(`DELETE FROM mastra_agent_versions`);
        await agentsTestStore.db.none(`DELETE FROM mastra_agents`);
      });

      it('listVersions skips rows whose jsonb model column is a scalar string instead of crashing', async () => {
        const agentId = `agent-${Date.now()}`;
        const goodVersionId = `${agentId}-v1`;
        const badVersionId = `${agentId}-v2`;

        // Seed the parent agent row
        await agentsTestStore.db.none(
          `INSERT INTO mastra_agents (id, status, "authorId", metadata, "createdAt", "updatedAt")
           VALUES ($1, 'draft', NULL, NULL, NOW(), NOW())`,
          [agentId],
        );

        // Good version with model stored as a jsonb object (the canonical shape)
        await agentsStore.createVersion({
          id: goodVersionId,
          agentId,
          versionNumber: 1,
          name: 'good-agent',
          instructions: 'be helpful',
          model: { slug: 'anthropic/claude-haiku-4.5' },
        });

        // Bad version: bypass createVersion (which now rejects strings) and write the
        // exact pathological shape the bug describes — jsonb scalar string. The pg
        // driver auto-deserialises this back to a JS string on read, which used to
        // make parseJson crash and take down the whole listing.
        await agentsTestStore.db.none(
          `INSERT INTO mastra_agent_versions (
             id, "agentId", "versionNumber", name, instructions, model,
             "createdAt", "createdAtZ"
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())`,
          [badVersionId, agentId, 2, 'bad-agent', 'be helpful', '"google/gemini-3-flash"'],
        );

        // The crucial assertion: the listing returns successfully (one bad row no
        // longer fails fast), and the bad row's model arrives as the deserialised
        // scalar instead of throwing.
        const result = await agentsStore.listVersions({ agentId, perPage: false });

        expect(result.versions.length).toBe(2);
        const versionsById = new Map(result.versions.map((v: any) => [v.id, v]));
        expect((versionsById.get(goodVersionId) as any)?.model).toEqual({
          slug: 'anthropic/claude-haiku-4.5',
        });
        expect((versionsById.get(badVersionId) as any)?.model).toBe('google/gemini-3-flash');
      });

      it('getVersion returns a jsonb scalar string model as the deserialised scalar instead of throwing', async () => {
        const agentId = `agent-${Date.now()}-getversion`;
        const versionId = `${agentId}-v1`;

        await agentsTestStore.db.none(
          `INSERT INTO mastra_agents (id, status, "authorId", metadata, "createdAt", "updatedAt")
           VALUES ($1, 'draft', NULL, NULL, NOW(), NOW())`,
          [agentId],
        );

        await agentsTestStore.db.none(
          `INSERT INTO mastra_agent_versions (
             id, "agentId", "versionNumber", name, instructions, model,
             "createdAt", "createdAtZ"
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())`,
          [versionId, agentId, 1, 'scalar-model-agent', 'be helpful', '"openai/gpt-4o-mini"'],
        );

        const version = await agentsStore.getVersion(versionId);

        expect(version).toBeDefined();
        expect(version.model).toBe('openai/gpt-4o-mini');
      });
    });

    // PG-specific: jsonb scalar string resilience across the other versioned
    // domains. Same bug class as #16224 (which originally fixed only the agents
    // domain) — each of mcpClients, mcpServers, promptBlocks, scorerDefinitions,
    // skills and workspaces used to ship its own private parseJson + fail-fast
    // .map(parseRow) that crashed when a single jsonb column contained a scalar
    // string (the pg driver auto-deserialises it to a bare JS string, which
    // JSON.parse then rejects).
    //
    // Each domain now uses the shared `parseJsonResilient` helper from
    // `domains/utils.ts` plus a `flatMap` + try/catch in its list methods, so
    // listings no longer fail fast on one malformed row. These tests assert that
    // resilient behaviour per domain.
    //
    // See: https://github.com/mastra-ai/mastra/issues/16224
    describe('Other PG domains: jsonb scalar string resilience (#16224 follow-up)', () => {
      let domainsTestStore: PostgresStore;

      beforeAll(async () => {
        domainsTestStore = new PostgresStore({ ...TEST_CONFIG, id: 'domains-jsonb-scalar-test' });
        await domainsTestStore.init();
      });

      afterAll(async () => {
        try {
          await domainsTestStore.close();
        } catch {}
      });

      beforeEach(async () => {
        // Wipe each versioned domain's tables — versions first because of FK direction
        await domainsTestStore.db.none(`DELETE FROM mastra_mcp_client_versions`);
        await domainsTestStore.db.none(`DELETE FROM mastra_mcp_clients`);
        await domainsTestStore.db.none(`DELETE FROM mastra_mcp_server_versions`);
        await domainsTestStore.db.none(`DELETE FROM mastra_mcp_servers`);
        await domainsTestStore.db.none(`DELETE FROM mastra_prompt_block_versions`);
        await domainsTestStore.db.none(`DELETE FROM mastra_prompt_blocks`);
        await domainsTestStore.db.none(`DELETE FROM mastra_scorer_definition_versions`);
        await domainsTestStore.db.none(`DELETE FROM mastra_scorer_definitions`);
        await domainsTestStore.db.none(`DELETE FROM mastra_skill_versions`);
        await domainsTestStore.db.none(`DELETE FROM mastra_skills`);
        await domainsTestStore.db.none(`DELETE FROM mastra_workspace_versions`);
        await domainsTestStore.db.none(`DELETE FROM mastra_workspaces`);
      });

      it('MCPClientsPG.listVersions returns a jsonb scalar string `servers` column as the deserialised scalar', async () => {
        const mcpClientsStore: any = await domainsTestStore.getStore('mcpClients');
        const parentId = `mcp-client-${Date.now()}`;
        const versionId = `${parentId}-v1`;

        await domainsTestStore.db.none(
          `INSERT INTO mastra_mcp_clients (id, status, "authorId", metadata, "createdAt", "updatedAt")
           VALUES ($1, 'draft', NULL, NULL, NOW(), NOW())`,
          [parentId],
        );

        // jsonb scalar string in the required `servers` column. Pre-fix this crashed
        // listVersions; post-fix the row survives and `servers` arrives as a string.
        await domainsTestStore.db.none(
          `INSERT INTO mastra_mcp_client_versions (
             id, "mcpClientId", "versionNumber", name, servers, "createdAt"
           ) VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
          [versionId, parentId, 1, 'bad-client', '"servers-as-scalar-string"'],
        );

        const result = await mcpClientsStore.listVersions({ mcpClientId: parentId, perPage: false });

        expect(result.versions.length).toBe(1);
        expect(result.versions[0].id).toBe(versionId);
        expect(result.versions[0].servers).toBe('servers-as-scalar-string');
      });

      it('MCPServersPG.listVersions returns a jsonb scalar string `tools` column as the deserialised scalar', async () => {
        const mcpServersStore: any = await domainsTestStore.getStore('mcpServers');
        const parentId = `mcp-server-${Date.now()}`;
        const versionId = `${parentId}-v1`;

        await domainsTestStore.db.none(
          `INSERT INTO mastra_mcp_servers (id, status, "authorId", metadata, "createdAt", "updatedAt")
           VALUES ($1, 'draft', NULL, NULL, NOW(), NOW())`,
          [parentId],
        );

        await domainsTestStore.db.none(
          `INSERT INTO mastra_mcp_server_versions (
             id, "mcpServerId", "versionNumber", name, version, tools, "createdAt"
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
          [versionId, parentId, 1, 'bad-server', '1.0.0', '"tools-as-scalar-string"'],
        );

        const result = await mcpServersStore.listVersions({ mcpServerId: parentId, perPage: false });

        expect(result.versions.length).toBe(1);
        expect(result.versions[0].id).toBe(versionId);
        expect(result.versions[0].tools).toBe('tools-as-scalar-string');
      });

      it('PromptBlocksPG.listVersions returns a jsonb scalar string `rules` column as the deserialised scalar', async () => {
        const promptBlocksStore: any = await domainsTestStore.getStore('promptBlocks');
        const parentId = `prompt-block-${Date.now()}`;
        const versionId = `${parentId}-v1`;

        await domainsTestStore.db.none(
          `INSERT INTO mastra_prompt_blocks (id, status, "authorId", metadata, "createdAt", "updatedAt")
           VALUES ($1, 'draft', NULL, NULL, NOW(), NOW())`,
          [parentId],
        );

        await domainsTestStore.db.none(
          `INSERT INTO mastra_prompt_block_versions (
             id, "blockId", "versionNumber", name, content, rules, "createdAt"
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
          [versionId, parentId, 1, 'bad-block', 'some content', '"rules-as-scalar-string"'],
        );

        const result = await promptBlocksStore.listVersions({ blockId: parentId, perPage: false });

        expect(result.versions.length).toBe(1);
        expect(result.versions[0].id).toBe(versionId);
        expect(result.versions[0].rules).toBe('rules-as-scalar-string');
      });

      it('ScorerDefinitionsPG.listVersions returns a jsonb scalar string `model` column as the deserialised scalar', async () => {
        const scorerDefinitionsStore: any = await domainsTestStore.getStore('scorerDefinitions');
        const parentId = `scorer-${Date.now()}`;
        const versionId = `${parentId}-v1`;

        await domainsTestStore.db.none(
          `INSERT INTO mastra_scorer_definitions (id, status, "authorId", metadata, "createdAt", "updatedAt")
           VALUES ($1, 'draft', NULL, NULL, NOW(), NOW())`,
          [parentId],
        );

        // Same shape as the bug in #16224 — model stored as a jsonb scalar string.
        await domainsTestStore.db.none(
          `INSERT INTO mastra_scorer_definition_versions (
             id, "scorerDefinitionId", "versionNumber", name, type, model, "createdAt"
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
          [versionId, parentId, 1, 'bad-scorer', 'llm-judge', '"google/gemini-3-flash"'],
        );

        const result = await scorerDefinitionsStore.listVersions({ scorerDefinitionId: parentId, perPage: false });

        expect(result.versions.length).toBe(1);
        expect(result.versions[0].id).toBe(versionId);
        expect(result.versions[0].model).toBe('google/gemini-3-flash');
      });

      it('SkillsPG.listVersions returns a jsonb scalar string `source` column as the deserialised scalar', async () => {
        const skillsStore: any = await domainsTestStore.getStore('skills');
        const parentId = `skill-${Date.now()}`;
        const versionId = `${parentId}-v1`;

        await domainsTestStore.db.none(
          `INSERT INTO mastra_skills (id, status, "authorId", "createdAt", "updatedAt")
           VALUES ($1, 'draft', NULL, NOW(), NOW())`,
          [parentId],
        );

        await domainsTestStore.db.none(
          `INSERT INTO mastra_skill_versions (
             id, "skillId", "versionNumber", name, description, instructions, source, "createdAt"
           ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())`,
          [versionId, parentId, 1, 'bad-skill', 'desc', 'instructions', '"source-as-scalar-string"'],
        );

        const result = await skillsStore.listVersions({ skillId: parentId, perPage: false });

        expect(result.versions.length).toBe(1);
        expect(result.versions[0].id).toBe(versionId);
        expect(result.versions[0].source).toBe('source-as-scalar-string');
      });

      it('WorkspacesPG.listVersions returns a jsonb scalar string `filesystem` column as the deserialised scalar', async () => {
        const workspacesStore: any = await domainsTestStore.getStore('workspaces');
        const parentId = `workspace-${Date.now()}`;
        const versionId = `${parentId}-v1`;

        await domainsTestStore.db.none(
          `INSERT INTO mastra_workspaces (id, status, "authorId", metadata, "createdAt", "updatedAt")
           VALUES ($1, 'draft', NULL, NULL, NOW(), NOW())`,
          [parentId],
        );

        await domainsTestStore.db.none(
          `INSERT INTO mastra_workspace_versions (
             id, "workspaceId", "versionNumber", name, filesystem, "createdAt"
           ) VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
          [versionId, parentId, 1, 'bad-workspace', '"filesystem-as-scalar-string"'],
        );

        const result = await workspacesStore.listVersions({ workspaceId: parentId, perPage: false });

        expect(result.versions.length).toBe(1);
        expect(result.versions[0].id).toBe(versionId);
        expect(result.versions[0].filesystem).toBe('filesystem-as-scalar-string');
      });
    });

    describe('ScorerDefinitionsPG tenancy', () => {
      let tenancyStore: PostgresStore;

      const baseSnapshot = {
        name: 'Tenant Scorer',
        type: 'llm-judge' as const,
        model: { provider: 'openai', name: 'gpt-4' },
        instructions: 'Evaluate accuracy',
      };

      beforeAll(async () => {
        tenancyStore = new PostgresStore({ ...TEST_CONFIG, id: 'scorer-definitions-tenancy-test' });
        await tenancyStore.init();
      });

      afterAll(async () => {
        try {
          await tenancyStore.close();
        } catch {}
      });

      beforeEach(async () => {
        await tenancyStore.db.none(`DELETE FROM mastra_scorer_definition_versions`);
        await tenancyStore.db.none(`DELETE FROM mastra_scorer_definitions`);
      });

      it('persists organizationId/projectId on create and getById', async () => {
        const store: any = await tenancyStore.getStore('scorerDefinitions');
        const created = await store.create({
          scorerDefinition: { id: 'tenant-1', organizationId: 'org-a', projectId: 'proj-1', ...baseSnapshot },
        });
        expect(created.organizationId).toBe('org-a');
        expect(created.projectId).toBe('proj-1');

        const fetched = await store.getById('tenant-1');
        expect(fetched.organizationId).toBe('org-a');
        expect(fetched.projectId).toBe('proj-1');
      });

      it('filters list by organizationId, projectId, and both together', async () => {
        const store: any = await tenancyStore.getStore('scorerDefinitions');
        await store.create({
          scorerDefinition: { id: 'a1', organizationId: 'org-a', projectId: 'proj-1', ...baseSnapshot },
        });
        await store.create({
          scorerDefinition: { id: 'a2', organizationId: 'org-a', projectId: 'proj-2', ...baseSnapshot },
        });
        await store.create({
          scorerDefinition: { id: 'b1', organizationId: 'org-b', projectId: 'proj-1', ...baseSnapshot },
        });

        const byOrg = await store.list({ status: 'draft', organizationId: 'org-a' });
        expect(byOrg.total).toBe(2);
        expect(byOrg.scorerDefinitions.every((s: any) => s.organizationId === 'org-a')).toBe(true);

        const byProject = await store.list({ status: 'draft', projectId: 'proj-1' });
        expect(byProject.total).toBe(2);
        expect(byProject.scorerDefinitions.every((s: any) => s.projectId === 'proj-1')).toBe(true);

        const byBoth = await store.list({ status: 'draft', organizationId: 'org-a', projectId: 'proj-1' });
        expect(byBoth.total).toBe(1);
        expect(byBoth.scorerDefinitions[0].id).toBe('a1');

        const noMatch = await store.list({ status: 'draft', organizationId: 'org-c' });
        expect(noMatch.total).toBe(0);
      });

      it('propagates tenancy filters through listResolved', async () => {
        const store: any = await tenancyStore.getStore('scorerDefinitions');
        await store.create({
          scorerDefinition: { id: 'a1', organizationId: 'org-a', projectId: 'proj-1', ...baseSnapshot },
        });
        await store.create({
          scorerDefinition: { id: 'a2', organizationId: 'org-a', projectId: 'proj-2', ...baseSnapshot },
        });

        const resolved = await store.listResolved({ status: 'draft', organizationId: 'org-a', projectId: 'proj-2' });
        expect(resolved.total).toBe(1);
        expect(resolved.scorerDefinitions[0].id).toBe('a2');
        expect(resolved.scorerDefinitions[0].organizationId).toBe('org-a');
        expect(resolved.scorerDefinitions[0].name).toBe('Tenant Scorer');
      });
    });
  });
}
