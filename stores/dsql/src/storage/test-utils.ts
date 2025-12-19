import { createSampleThread } from '@internal/storage-test-utils';
import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DSQLConfig } from '../shared/config';
import { DSQLStore } from '.';

/**
 * Test configuration for Aurora DSQL.
 * Uses the same environment variables as integration tests.
 */
export const TEST_CONFIG: DSQLConfig = {
  id: 'test-dsql-store',
  host: process.env.DSQL_HOST || '',
  region: process.env.DSQL_REGION,
  user: process.env.DSQL_USER || 'admin',
  database: process.env.DSQL_DATABASE || 'postgres',
};

/**
 * Check if DSQL tests can run (requires real Aurora DSQL cluster)
 */
export function canRunDSQLTests(): boolean {
  return !!(process.env.DSQL_HOST && process.env.DSQL_INTEGRATION === 'true');
}

export function dsqlTests() {
  let store: DSQLStore;

  describe('DSQL specific tests', () => {
    beforeAll(async () => {
      store = new DSQLStore(TEST_CONFIG);
      await store.init();
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
        const result1 = await store.db.one('SELECT NOW() as timestamp1');
        const result2 = await store.db.one('SELECT NOW() as timestamp2');

        expect(result1.timestamp1).toBeDefined();
        expect(result2.timestamp2).toBeDefined();
        expect(new Date(result2.timestamp2).getTime()).toBeGreaterThanOrEqual(new Date(result1.timestamp1).getTime());
      });

      it('should throw error when pool is used after disconnect', async () => {
        await store.close();
        await expect(store.db.connect()).rejects.toThrow();
        store = new DSQLStore(TEST_CONFIG);
        await store.init();
      });
    });

    describe('DSQL Table Name Quoting', () => {
      const camelCaseTable = 'TestCamelCaseTable';
      const snakeCaseTable = 'test_snake_case_table';
      const BASE_SCHEMA = {
        id: { type: 'integer', primaryKey: true, nullable: false },
        name: { type: 'text', nullable: true },
        createdAt: { type: 'timestamp', nullable: false },
        updatedAt: { type: 'timestamp', nullable: false },
      } as Record<string, StorageColumn>;

      beforeEach(async () => {
        try {
          await store.clearTable({ tableName: camelCaseTable as TABLE_NAMES });
          await store.clearTable({ tableName: snakeCaseTable as TABLE_NAMES });
        } catch (error) {
          console.warn('Error clearing tables:', error);
        }
      });

      afterEach(async () => {
        try {
          await store.clearTable({ tableName: camelCaseTable as TABLE_NAMES });
          await store.clearTable({ tableName: snakeCaseTable as TABLE_NAMES });
        } catch (error) {
          console.warn('Error clearing tables:', error);
        }
      });

      it('should create and upsert to a camelCase table without quoting errors', async () => {
        await expect(
          store.createTable({
            tableName: camelCaseTable as TABLE_NAMES,
            schema: BASE_SCHEMA,
          }),
        ).resolves.not.toThrow();

        await store.insert({
          tableName: camelCaseTable as TABLE_NAMES,
          record: { id: '1', name: 'Alice', createdAt: new Date(), updatedAt: new Date() },
        });

        const row: any = await store.load({
          tableName: camelCaseTable as TABLE_NAMES,
          keys: { id: '1' },
        });
        expect(row?.name).toBe('Alice');
      });

      it('should create and upsert to a snake_case table without quoting errors', async () => {
        await expect(
          store.createTable({
            tableName: snakeCaseTable as TABLE_NAMES,
            schema: BASE_SCHEMA,
          }),
        ).resolves.not.toThrow();

        await store.insert({
          tableName: snakeCaseTable as TABLE_NAMES,
          record: { id: '2', name: 'Bob', createdAt: new Date(), updatedAt: new Date() },
        });

        const row: any = await store.load({
          tableName: snakeCaseTable as TABLE_NAMES,
          keys: { id: '2' },
        });
        expect(row?.name).toBe('Bob');
      });
    });

    describe('Aurora DSQL Specific Features', () => {
      it('should handle insert and load operations', async () => {
        const tableName = 'occ_test_table';
        const schema = {
          id: { type: 'text', primaryKey: true, nullable: false },
          counter: { type: 'integer', nullable: false },
          createdAt: { type: 'timestamp', nullable: false },
          updatedAt: { type: 'timestamp', nullable: false },
        } as Record<string, StorageColumn>;

        try {
          await store.createTable({ tableName: tableName as TABLE_NAMES, schema });
          await store.insert({
            tableName: tableName as TABLE_NAMES,
            record: { id: 'test', counter: 0, createdAt: new Date(), updatedAt: new Date() },
          });

          const result: any = await store.load({
            tableName: tableName as TABLE_NAMES,
            keys: { id: 'test' },
          });
          expect(result?.counter).toBe(0);
        } finally {
          await store.clearTable({ tableName: tableName as TABLE_NAMES });
        }
      });

      it('should respect 3000 row batch limit', async () => {
        const tableName = 'batch_test_table';
        const schema = {
          id: { type: 'text', primaryKey: true, nullable: false },
          data: { type: 'text', nullable: true },
          createdAt: { type: 'timestamp', nullable: false },
          updatedAt: { type: 'timestamp', nullable: false },
        } as Record<string, StorageColumn>;

        try {
          await store.createTable({ tableName: tableName as TABLE_NAMES, schema });

          const records = Array.from({ length: 100 }, (_, i) => ({
            id: `batch-${i}`,
            data: `data-${i}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          await store.batchInsert({
            tableName: tableName as TABLE_NAMES,
            records,
          });

          const result = await store.db.one(`SELECT COUNT(*) as count FROM "${tableName}"`);
          expect(Number(result.count)).toBe(100);
        } finally {
          await store.clearTable({ tableName: tableName as TABLE_NAMES });
        }
      });

      it('should use TEXT instead of JSONB for JSON columns', async () => {
        const tableName = 'json_test_table';
        const schema = {
          id: { type: 'text', primaryKey: true, nullable: false },
          metadata: { type: 'jsonb', nullable: true },
          createdAt: { type: 'timestamp', nullable: false },
          updatedAt: { type: 'timestamp', nullable: false },
        } as Record<string, StorageColumn>;

        try {
          await store.createTable({ tableName: tableName as TABLE_NAMES, schema });

          const columnInfo = await store.db.oneOrNone(
            `SELECT data_type FROM information_schema.columns 
             WHERE table_name = $1 AND column_name = 'metadata'`,
            [tableName.toLowerCase()],
          );

          // Aurora DSQL converts JSONB to TEXT
          expect(columnInfo?.data_type).toBe('text');
        } finally {
          await store.clearTable({ tableName: tableName as TABLE_NAMES });
        }
      });
    });

    describe('Timestamp Fallback Handling', () => {
      let testThreadId: string;
      let testResourceId: string;
      let testMessageId: string;

      beforeEach(async () => {
        testThreadId = `thread-${Date.now()}`;
        testResourceId = `resource-${Date.now()}`;
        testMessageId = `msg-${Date.now()}`;
      });

      it('should use createdAtZ over createdAt for messages when both exist', async () => {
        // Create a thread first
        const thread = createSampleThread({ id: testThreadId, resourceId: testResourceId });
        await store.saveThread({ thread });

        // Directly insert a message with both createdAt and createdAtZ where they differ
        const createdAtValue = new Date('2024-01-01T10:00:00Z');
        const createdAtZValue = new Date('2024-01-01T15:00:00Z'); // 5 hours later - clearly different

        await store.db.none(
          `INSERT INTO mastra_messages (id, thread_id, content, role, type, "resourceId", "createdAt", "createdAtZ")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [testMessageId, testThreadId, 'Test message', 'user', 'v2', testResourceId, createdAtValue, createdAtZValue],
        );

        // Test listMessagesById
        const messagesByIdResult = await store.listMessagesById({ messageIds: [testMessageId] });
        expect(messagesByIdResult.messages.length).toBe(1);
        expect(messagesByIdResult.messages[0]?.createdAt).toBeInstanceOf(Date);
        expect(messagesByIdResult.messages[0]?.createdAt.getTime()).toBe(createdAtZValue.getTime());
        expect(messagesByIdResult.messages[0]?.createdAt.getTime()).not.toBe(createdAtValue.getTime());

        // Test listMessages
        const messagesResult = await store.listMessages({
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
        await store.saveThread({ thread });

        // Directly insert a message with only createdAt (simulating old records)
        const createdAtValue = new Date('2024-01-01T10:00:00Z');

        await store.db.none(
          `INSERT INTO mastra_messages (id, thread_id, content, role, type, "resourceId", "createdAt", "createdAtZ")
             VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`,
          [testMessageId, testThreadId, 'Legacy message', 'user', 'v2', testResourceId, createdAtValue],
        );

        // Test listMessagesById
        const messagesByIdResult = await store.listMessagesById({ messageIds: [testMessageId] });
        expect(messagesByIdResult.messages.length).toBe(1);
        expect(messagesByIdResult.messages[0]?.createdAt).toBeInstanceOf(Date);
        expect(messagesByIdResult.messages[0]?.createdAt.getTime()).toBe(createdAtValue.getTime());

        // Test listMessages
        const messagesResult = await store.listMessages({
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
        await store.saveThread({ thread });

        // Save a message through the normal API with a different timestamp
        const messageCreatedAt = new Date('2024-01-01T12:00:00Z');
        await store.saveMessages({
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
        const retrievedThread = await store.getThreadById({ threadId: testThreadId });
        expect(retrievedThread).toBeTruthy();
        expect(retrievedThread?.createdAt).toBeInstanceOf(Date);
        expect(retrievedThread?.createdAt.getTime()).toBe(threadCreatedAt.getTime());

        // Get messages
        const messagesResult = await store.listMessages({ threadId: testThreadId });
        expect(messagesResult.messages.length).toBe(1);
        expect(messagesResult.messages[0]?.createdAt).toBeInstanceOf(Date);
        expect(messagesResult.messages[0]?.createdAt.getTime()).toBe(messageCreatedAt.getTime());
      });

      it('should handle included messages with correct timestamp fallback', async () => {
        // Create a thread
        const thread = createSampleThread({ id: testThreadId, resourceId: testResourceId });
        await store.saveThread({ thread });

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
        const messagesResult = await store.listMessages({
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
        const message1 = messagesResult.messages.find(m => m.id === msg1Id);
        expect(message1).toBeDefined();
        expect(message1?.createdAt).toBeInstanceOf(Date);
        expect(message1?.createdAt.getTime()).toBe(date1.getTime());

        const message2 = messagesResult.messages.find(m => m.id === msg2Id);
        expect(message2).toBeDefined();
        expect(message2?.createdAt).toBeInstanceOf(Date);
        expect(message2?.createdAt.getTime()).toBe(date2.getTime());

        const message3 = messagesResult.messages.find(m => m.id === msg3Id);
        expect(message3).toBeDefined();
        expect(message3?.createdAt).toBeInstanceOf(Date);
        // Should use createdAtZ (date2Z), not createdAt (date3)
        expect(message3?.createdAt.getTime()).toBe(date2Z.getTime());
        expect(message3?.createdAt.getTime()).not.toBe(date3.getTime());
      });
    });

    describe('Store Initialization', () => {
      it('throws if store is not initialized', () => {
        const uninitializedStore = new DSQLStore(TEST_CONFIG);
        expect(() => uninitializedStore.db).toThrow(/DSQLStore: Store is not initialized/);
        expect(() => uninitializedStore.pgp).toThrow(/DSQLStore: Store is not initialized/);
      });
    });
  });
}
