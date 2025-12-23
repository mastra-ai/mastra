import { createSampleThread } from '@internal/storage-test-utils';
import type { MemoryStorage, StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import pgPromise from 'pg-promise';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PostgresStoreConfig } from '../shared/config';
import { PgDB } from './db';
import { MemoryPG } from './domains/memory';
import { PostgresStore } from '.';

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
      // Create PgDB instance for low-level operations (not exposed on main store)
      dbOps = new PgDB({ client: store.db });
    });
    afterAll(async () => {
      try {
        await store.close();
      } catch {}
    });

    describe('Public Fields Access', () => {
      it('should expose db field as public', () => {
        expect(store.db).toBeDefined();
        expect(typeof store.db).toBe('object');
        expect(store.db.query).toBeDefined();
        expect(typeof store.db.query).toBe('function');
      });

      it('should expose pgp field as public', () => {
        expect(store.pgp).toBeDefined();
        expect(typeof store.pgp).toBe('function');
        expect(store.pgp.end).toBeDefined();
        expect(typeof store.pgp.end).toBe('function');
      });

      it('should allow direct database queries via public db field', async () => {
        const result = await store.db.one('SELECT 1 as test');
        expect(result.test).toBe(1);
      });

      it('should allow access to pgp utilities via public pgp field', () => {
        const helpers = store.pgp.helpers;
        expect(helpers).toBeDefined();
        expect(helpers.insert).toBeDefined();
        expect(helpers.update).toBeDefined();
      });

      it('should maintain connection state through public db field', async () => {
        // Test multiple queries to ensure connection state
        const result1 = await store.db.one('SELECT NOW() as timestamp1');
        const result2 = await store.db.one('SELECT NOW() as timestamp2');

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
      let adminDb: pgPromise.IDatabase<{}>;
      let pgpAdmin: pgPromise.IMain;

      beforeAll(async () => {
        // Re-initialize the main store for subsequent tests

        await store.init();

        // Create a separate pg-promise instance for admin operations
        pgpAdmin = pgPromise();
        adminDb = pgpAdmin(connectionString);
        try {
          await adminDb.tx(async t => {
            // Drop the test schema if it exists from previous runs
            await t.none(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);

            // Create schema restricted user with minimal permissions
            await t.none(`          
                DO $$
                BEGIN
                  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${schemaRestrictedUser}') THEN
                    CREATE USER ${schemaRestrictedUser} WITH PASSWORD '${restrictedPassword}' NOCREATEDB;
                  END IF;
                END
                $$;`);

            // Grant only connect and usage to schema restricted user
            await t.none(`
                  REVOKE ALL ON DATABASE ${(TEST_CONFIG as any).database} FROM ${schemaRestrictedUser};
                  GRANT CONNECT ON DATABASE ${(TEST_CONFIG as any).database} TO ${schemaRestrictedUser};
                  REVOKE ALL ON SCHEMA public FROM ${schemaRestrictedUser};
                  GRANT USAGE ON SCHEMA public TO ${schemaRestrictedUser};
                `);
          });
        } catch (error) {
          // Clean up the database connection on error
          pgpAdmin.end();
          throw error;
        }
      });

      afterAll(async () => {
        try {
          // Then clean up test user in admin connection
          await adminDb.tx(async t => {
            await t.none(`
                  REASSIGN OWNED BY ${schemaRestrictedUser} TO postgres;
                  DROP OWNED BY ${schemaRestrictedUser};
                  DROP USER IF EXISTS ${schemaRestrictedUser};
                `);
          });

          // Finally clean up admin connection
          if (pgpAdmin) {
            pgpAdmin.end();
          }
        } catch (error) {
          console.error('Error cleaning up test user:', error);
          if (pgpAdmin) pgpAdmin.end();
        }
      });

      describe('Schema Creation', () => {
        beforeEach(async () => {
          // Create a fresh connection for each test
          const tempPgp = pgPromise();
          const tempDb = tempPgp(connectionString);

          try {
            // Ensure schema doesn't exist before each test
            await tempDb.none(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);

            // Ensure no active connections from restricted user
            await tempDb.none(`
                  SELECT pg_terminate_backend(pid) 
                  FROM pg_stat_activity 
                  WHERE usename = '${schemaRestrictedUser}'
                `);
          } finally {
            tempPgp.end(); // Always clean up the connection
          }
        });

        afterEach(async () => {
          // Create a fresh connection for cleanup
          const tempPgp = pgPromise();
          const tempDb = tempPgp(connectionString);

          try {
            // Clean up any connections from the restricted user and drop schema
            await tempDb.none(`
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
          } catch (error) {
            console.error('Error in afterEach cleanup:', error);
          } finally {
            tempPgp.end(); // Always clean up the connection
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

          // Create a fresh connection for verification
          const tempPgp = pgPromise();
          const tempDb = tempPgp(connectionString);

          try {
            // Test schema creation by initializing the store
            await expect(async () => {
              await restrictedDB.init();
            }).rejects.toThrow(
              `Unable to create schema "${testSchema}". This requires CREATE privilege on the database.`,
            );

            // Verify schema was not created
            const exists = await tempDb.oneOrNone(
              `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)`,
              [testSchema],
            );
            expect(exists?.exists).toBe(false);
          } finally {
            await restrictedDB.close();
            tempPgp.end(); // Clean up the verification connection
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

          // Create a fresh connection for verification
          const tempPgp = pgPromise();
          const tempDb = tempPgp(connectionString);

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
            const exists = await tempDb.oneOrNone(
              `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1)`,
              [testSchema],
            );
            expect(exists?.exists).toBe(false);
          } finally {
            await restrictedDB.close();
            tempPgp.end(); // Clean up the verification connection
          }
        });
      });
    });

    describe('Function Namespace in Schema', () => {
      const testSchema = 'schema_fn_test';
      let testStore: PostgresStore;

      beforeAll(async () => {
        // Use a temp connection to set up schema
        const tempPgp = pgPromise();
        const tempDb = tempPgp(connectionString);

        try {
          await tempDb.none(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
          await tempDb.none(`CREATE SCHEMA ${testSchema}`);
          // Drop the function from public schema if it exists from other tests
          await tempDb.none(`DROP FUNCTION IF EXISTS public.trigger_set_timestamps() CASCADE`);
        } finally {
          tempPgp.end();
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

        // Use a temp connection to clean up
        const tempPgp = pgPromise();
        const tempDb = tempPgp(connectionString);

        try {
          await tempDb.none(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
        } finally {
          tempPgp.end();
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
        const functionInfo = await testStore.db.oneOrNone(
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

    // PG-specific: db and pgp field exposure with pre-configured client
    describe('Pre-configured Client Field Exposure', () => {
      it('should expose db and pgp fields with pre-configured client', () => {
        const pgp = pgPromise();
        const client = pgp(connectionString);

        const clientStore = new PostgresStore({
          id: 'pre-configured-client-fields-store',
          client,
        });

        // db should be the same client we passed in
        expect(clientStore.db).toBe(client);
        // pgp should be defined (may be a new instance or the one used internally)
        expect(clientStore.pgp).toBeDefined();

        // Clean up
        pgp.end();
      });
    });

    // PG-specific: Domain schemaName verification with pre-configured client
    describe('Domain schemaName with Pre-configured Client', () => {
      it('should allow domains to use custom schemaName with pre-configured client', async () => {
        const pgp = pgPromise();
        const client = pgp(connectionString);

        // Create schema for test
        await client.none('CREATE SCHEMA IF NOT EXISTS domain_test_schema');

        try {
          const memoryDomain = new MemoryPG({
            client,
            schemaName: 'domain_test_schema',
          });

          expect(memoryDomain).toBeDefined();
          await memoryDomain.init();

          // Verify tables were created in the custom schema
          const tableExists = await client.oneOrNone(
            `SELECT EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'domain_test_schema'
              AND table_name = 'mastra_threads'
            )`,
          );
          expect(tableExists?.exists).toBe(true);
        } finally {
          // Clean up
          await client.none('DROP SCHEMA IF EXISTS domain_test_schema CASCADE');
          pgp.end();
        }
      });
    });
  });
}
