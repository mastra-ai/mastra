import { randomUUID } from 'crypto';
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import type { MetricResult } from '@mastra/core/eval';
import type { MastraStorage, StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import {
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_THREADS,
} from '@mastra/core/storage';
import { createScoresTest } from './domains/scores';
import { createConversationsTest } from './domains/conversations';
import { createTestSuiteWorkflows } from './domains/workflows';
import { createTraceTests } from './domains/traces';
import { createEvalsTests } from './domains/evals';

export * from './domains/conversations/data';
export * from './domains/workflows/data';
export * from './domains/evals/data';

export const createSampleTraceForDB = (
  name: string,
  scope?: string,
  attributes?: Record<string, string>,
  createdAt?: Date,
) => ({
  id: `trace-${randomUUID()}`,
  parentSpanId: `span-${randomUUID()}`,
  traceId: `trace-${randomUUID()}`,
  name,
  scope,
  kind: 0,
  status: JSON.stringify({ code: 'success' }),
  events: JSON.stringify([{ name: 'start', timestamp: Date.now() }]),
  links: JSON.stringify([]),
  attributes: attributes ? attributes : undefined,
  startTime: (createdAt || new Date()).getTime(),
  endTime: (createdAt || new Date()).getTime(),
  other: JSON.stringify({ custom: 'data' }),
  createdAt: createdAt || new Date(),
});



export function createTestSuite(storage: MastraStorage) {
  describe(storage.constructor.name, () => {
    beforeAll(async () => {
      await storage.init();
    });

    beforeEach(async () => {
      // Clear tables before each test
      await storage.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
      await storage.clearTable({ tableName: TABLE_EVALS });
      await storage.clearTable({ tableName: TABLE_MESSAGES });
      await storage.clearTable({ tableName: TABLE_THREADS });
    });

    afterAll(async () => {
      // Clear tables after tests
      await storage.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
      await storage.clearTable({ tableName: TABLE_EVALS });
      await storage.clearTable({ tableName: TABLE_MESSAGES });
      await storage.clearTable({ tableName: TABLE_THREADS });
    });


    createTestSuiteWorkflows(storage);

    createTraceTests(storage);

    createEvalsTests(storage);


  });

  describe('hasColumn', () => {
    const tempTable = `temp_test_table`;

    beforeAll(async () => {
      // Always try to drop the table after each test, ignore errors if it doesn't exist
      try {
        await storage.dropTable({ tableName: tempTable as TABLE_NAMES });
      } catch (e) {
        console.log(e);
        /* ignore */
      }
    });

    it('returns if the column does / does not exist', async () => {
      await storage.createTable({
        tableName: tempTable as TABLE_NAMES,
        schema: {
          id: { type: 'integer', primaryKey: true, nullable: false },
        },
      });

      if ('stores' in storage) {
        expect(await storage.stores!.operations.hasColumn(tempTable, 'resourceId')).toBe(false);
      }

      await storage.alterTable({
        tableName: tempTable as TABLE_NAMES, schema: {
          id: { type: 'integer', primaryKey: true, nullable: false },
          resourceId: { type: 'text', nullable: true },
        }, ifNotExists: ['resourceId']
      });

      if ('stores' in storage) {
        expect(await storage.stores!.operations.hasColumn(tempTable, 'resourceId')).toBe(true);
      }
    });

  });



  describe('alterTable', () => {
    const TEST_TABLE = 'test_alter_table';
    const BASE_SCHEMA = {
      id: { type: 'integer', primaryKey: true, nullable: false },
      name: { type: 'text', nullable: true },
      createdAt: { type: 'timestamp', nullable: false },
    } as Record<string, StorageColumn>;

    beforeEach(async () => {
      await storage.createTable({ tableName: TEST_TABLE as TABLE_NAMES, schema: BASE_SCHEMA });
    });

    afterEach(async () => {
      await storage.clearTable({ tableName: TEST_TABLE as TABLE_NAMES });
    });

    it('adds a new column to an existing table', async () => {
      await storage.alterTable({
        tableName: TEST_TABLE as TABLE_NAMES,
        schema: { ...BASE_SCHEMA, age: { type: 'integer', nullable: true } },
        ifNotExists: ['age'],
      });

      await storage.insert({
        tableName: TEST_TABLE as TABLE_NAMES,
        record: { id: 1, name: 'Alice', age: 42, createdAt: new Date() },
      });

      const row = await storage.load<{ id: string; name: string; age?: number }>({
        tableName: TEST_TABLE as TABLE_NAMES,
        keys: { id: '1' },
      });
      expect(row?.age).toBe(42);
    });

    it('is idempotent when adding an existing column', async () => {
      await storage.alterTable({
        tableName: TEST_TABLE as TABLE_NAMES,
        schema: { ...BASE_SCHEMA, foo: { type: 'text', nullable: true } },
        ifNotExists: ['foo'],
      });
      // Add the column again (should not throw)
      await expect(
        storage.alterTable({
          tableName: TEST_TABLE as TABLE_NAMES,
          schema: { ...BASE_SCHEMA, foo: { type: 'text', nullable: true } },
          ifNotExists: ['foo'],
        }),
      ).resolves.not.toThrow();
    });

    it('should add a default value to a column when using not null', async () => {
      await storage.insert({
        tableName: TEST_TABLE as TABLE_NAMES,
        record: { id: 1, name: 'Bob', createdAt: new Date() },
      });

      await expect(
        storage.alterTable({
          tableName: TEST_TABLE as TABLE_NAMES,
          schema: { ...BASE_SCHEMA, text_column: { type: 'text', nullable: false } },
          ifNotExists: ['text_column'],
        }),
      ).resolves.not.toThrow();

      await expect(
        storage.alterTable({
          tableName: TEST_TABLE as TABLE_NAMES,
          schema: { ...BASE_SCHEMA, timestamp_column: { type: 'timestamp', nullable: false } },
          ifNotExists: ['timestamp_column'],
        }),
      ).resolves.not.toThrow();

      await expect(
        storage.alterTable({
          tableName: TEST_TABLE as TABLE_NAMES,
          schema: { ...BASE_SCHEMA, bigint_column: { type: 'bigint', nullable: false } },
          ifNotExists: ['bigint_column'],
        }),
      ).resolves.not.toThrow();

      await expect(
        storage.alterTable({
          tableName: TEST_TABLE as TABLE_NAMES,
          schema: { ...BASE_SCHEMA, jsonb_column: { type: 'jsonb', nullable: false } },
          ifNotExists: ['jsonb_column'],
        }),
      ).resolves.not.toThrow();
    });
  });

  createConversationsTest({ storage });
  createScoresTest({ storage });
}
