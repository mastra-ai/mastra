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

export * from './domains/conversations/data';
export * from './domains/workflows/data';

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

export const createSampleEval = (agentName: string, isTest = false, createdAt?: Date) => {
  const testInfo = isTest ? { testPath: 'test/path.ts', testName: 'Test Name' } : undefined;

  return {
    agent_name: agentName,
    input: 'Sample input',
    output: 'Sample output',
    result: { score: 0.8 } as MetricResult,
    metric_name: 'sample-metric',
    instructions: 'Sample instructions',
    test_info: testInfo,
    global_run_id: `global-${randomUUID()}`,
    run_id: `run-${randomUUID()}`,
    created_at: createdAt || new Date().toISOString(),
    createdAt: createdAt || new Date(),
  };
};

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
      } else {
        expect(await storage['hasColumn'](tempTable, 'resourceId')).toBe(false);
      }

      await storage.alterTable({
        tableName: tempTable as TABLE_NAMES, schema: {
          id: { type: 'integer', primaryKey: true, nullable: false },
          resourceId: { type: 'text', nullable: true },
        }, ifNotExists: ['resourceId']
      });

      if ('stores' in storage) {
        expect(await storage.stores!.operations.hasColumn(tempTable, 'resourceId')).toBe(true);
      } else {
        expect(await storage['hasColumn'](tempTable, 'resourceId')).toBe(true);
      }
    });

  });

  describe('Eval Operations', () => {
    const createSampleEval = (agentName: string, isTest = false) => {
      const testInfo = isTest ? { testPath: 'test/path.ts', testName: 'Test Name' } : undefined;

      return {
        id: randomUUID(),
        agentName,
        input: 'Sample input',
        output: 'Sample output',
        result: { score: 0.8 } as MetricResult,
        metricName: 'sample-metric',
        instructions: 'Sample instructions',
        testInfo,
        globalRunId: `global-${randomUUID()}`,
        runId: `run-${randomUUID()}`,
        createdAt: new Date().toISOString(),
      };
    };

    it('should retrieve evals by agent name', async () => {
      const agentName = `test-agent-${randomUUID()}`;

      // Create sample evals
      const liveEval = createSampleEval(agentName, false);
      const testEval = createSampleEval(agentName, true);
      const otherAgentEval = createSampleEval(`other-agent-${randomUUID()}`, false);

      // Insert evals
      await storage.insert({
        tableName: TABLE_EVALS,
        record: {
          agent_name: liveEval.agentName,
          input: liveEval.input,
          output: liveEval.output,
          result: liveEval.result,
          metric_name: liveEval.metricName,
          instructions: liveEval.instructions,
          test_info: null,
          global_run_id: liveEval.globalRunId,
          run_id: liveEval.runId,
          created_at: liveEval.createdAt,
          createdAt: new Date(liveEval.createdAt),
        },
      });

      await storage.insert({
        tableName: TABLE_EVALS,
        record: {
          agent_name: testEval.agentName,
          input: testEval.input,
          output: testEval.output,
          result: testEval.result,
          metric_name: testEval.metricName,
          instructions: testEval.instructions,
          test_info: JSON.stringify(testEval.testInfo),
          global_run_id: testEval.globalRunId,
          run_id: testEval.runId,
          created_at: testEval.createdAt,
          createdAt: new Date(testEval.createdAt),
        },
      });

      await storage.insert({
        tableName: TABLE_EVALS,
        record: {
          agent_name: otherAgentEval.agentName,
          input: otherAgentEval.input,
          output: otherAgentEval.output,
          result: otherAgentEval.result,
          metric_name: otherAgentEval.metricName,
          instructions: otherAgentEval.instructions,
          test_info: null,
          global_run_id: otherAgentEval.globalRunId,
          run_id: otherAgentEval.runId,
          created_at: otherAgentEval.createdAt,
          createdAt: new Date(otherAgentEval.createdAt),
        },
      });

      // Test getting all evals for the agent
      const allEvals = await storage.getEvalsByAgentName(agentName);
      expect(allEvals).toHaveLength(2);
      expect(allEvals.map(e => e.runId)).toEqual(expect.arrayContaining([liveEval.runId, testEval.runId]));

      // Test getting only live evals
      const liveEvals = await storage.getEvalsByAgentName(agentName, 'live');
      expect(liveEvals).toHaveLength(1);
      expect(liveEvals?.[0]?.runId).toBe(liveEval.runId);

      // Test getting only test evals
      const testEvals = await storage.getEvalsByAgentName(agentName, 'test');
      expect(testEvals).toHaveLength(1);
      expect(testEvals?.[0]?.runId).toBe(testEval.runId);
      expect(testEvals?.[0]?.testInfo).toEqual(testEval.testInfo);

      // Test getting evals for non-existent agent
      const nonExistentEvals = await storage.getEvalsByAgentName('non-existent-agent');
      expect(nonExistentEvals).toHaveLength(0);
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
