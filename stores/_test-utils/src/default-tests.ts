import { randomUUID } from 'crypto';
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import type { MetricResult } from '@mastra/core/eval';
import type { WorkflowRunState } from '@mastra/core/workflows';
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

export * from './domains/conversations/data';

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

export const createSampleWorkflowSnapshot = (status: string, createdAt?: Date) => {
  const runId = `run-${randomUUID()}`;
  const stepId = `step-${randomUUID()}`;
  const timestamp = createdAt || new Date();
  const snapshot = {
    result: { success: true },
    value: {},
    context: {
      [stepId]: {
        status,
        payload: {},
        error: undefined,
        startedAt: timestamp.getTime(),
        endedAt: new Date(timestamp.getTime() + 15000).getTime(),
      },
      input: {},
    },
    serializedStepGraph: [],
    activePaths: [],
    suspendedPaths: {},
    runId,
    timestamp: timestamp.getTime(),
    status: status as WorkflowRunState['status'],
  } as WorkflowRunState;
  return { snapshot, runId, stepId };
};

export const checkWorkflowSnapshot = (snapshot: WorkflowRunState | string, stepId: string, status: string) => {
  if (typeof snapshot === 'string') {
    throw new Error('Expected WorkflowRunState, got string');
  }
  expect(snapshot.context?.[stepId]?.status).toBe(status);
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


    describe('getWorkflowRuns', () => {
      beforeEach(async () => {
        await storage.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
      });
      it('returns empty array when no workflows exist', async () => {
        const { runs, total } = await storage.getWorkflowRuns();
        expect(runs).toEqual([]);
        expect(total).toBe(0);
      });

      it('returns all workflows by default', async () => {
        const workflowName1 = 'default_test_1';
        const workflowName2 = 'default_test_2';

        const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('completed');
        const { snapshot: workflow2, runId: runId2, stepId: stepId2 } = createSampleWorkflowSnapshot('running');

        await storage.persistWorkflowSnapshot({ workflowName: workflowName1, runId: runId1, snapshot: workflow1 });
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
        await storage.persistWorkflowSnapshot({ workflowName: workflowName2, runId: runId2, snapshot: workflow2 });

        const { runs, total } = await storage.getWorkflowRuns();
        expect(runs).toHaveLength(2);
        expect(total).toBe(2);
        expect(runs[0]!.workflowName).toBe(workflowName2); // Most recent first
        expect(runs[1]!.workflowName).toBe(workflowName1);
        const firstSnapshot = runs[0]!.snapshot as WorkflowRunState;
        const secondSnapshot = runs[1]!.snapshot as WorkflowRunState;
        expect(firstSnapshot.context?.[stepId2]?.status).toBe('running');
        expect(secondSnapshot.context?.[stepId1]?.status).toBe('completed');
      });

      it('filters by workflow name', async () => {
        const workflowName1 = 'filter_test_1';
        const workflowName2 = 'filter_test_2';

        const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('completed');
        const { snapshot: workflow2, runId: runId2 } = createSampleWorkflowSnapshot('failed');

        await storage.persistWorkflowSnapshot({ workflowName: workflowName1, runId: runId1, snapshot: workflow1 });
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
        await storage.persistWorkflowSnapshot({ workflowName: workflowName2, runId: runId2, snapshot: workflow2 });

        const { runs, total } = await storage.getWorkflowRuns({ workflowName: workflowName1 });
        expect(runs).toHaveLength(1);
        expect(total).toBe(1);
        expect(runs[0]!.workflowName).toBe(workflowName1);
        const snapshot = runs[0]!.snapshot as WorkflowRunState;
        expect(snapshot.context?.[stepId1]?.status).toBe('completed');
      });

      it('filters by date range', async () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        const workflowName1 = 'date_test_1';
        const workflowName2 = 'date_test_2';
        const workflowName3 = 'date_test_3';

        const { snapshot: workflow1, runId: runId1 } = createSampleWorkflowSnapshot('completed');
        const { snapshot: workflow2, runId: runId2, stepId: stepId2 } = createSampleWorkflowSnapshot('running');
        const { snapshot: workflow3, runId: runId3, stepId: stepId3 } = createSampleWorkflowSnapshot('waiting');

        await storage.insert({
          tableName: TABLE_WORKFLOW_SNAPSHOT,
          record: {
            workflow_name: workflowName1,
            run_id: runId1,
            snapshot: workflow1,
            createdAt: twoDaysAgo,
            updatedAt: twoDaysAgo,
          },
        });
        await storage.insert({
          tableName: TABLE_WORKFLOW_SNAPSHOT,
          record: {
            workflow_name: workflowName2,
            run_id: runId2,
            snapshot: workflow2,
            createdAt: yesterday,
            updatedAt: yesterday,
          },
        });
        await storage.insert({
          tableName: TABLE_WORKFLOW_SNAPSHOT,
          record: {
            workflow_name: workflowName3,
            run_id: runId3,
            snapshot: workflow3,
            createdAt: now,
            updatedAt: now,
          },
        });

        const { runs } = await storage.getWorkflowRuns({
          fromDate: yesterday,
          toDate: now,
        });

        expect(runs).toHaveLength(2);
        expect(runs[0]!.workflowName).toBe(workflowName3);
        expect(runs[1]!.workflowName).toBe(workflowName2);
        const firstSnapshot = runs[0]!.snapshot as WorkflowRunState;
        const secondSnapshot = runs[1]!.snapshot as WorkflowRunState;
        expect(firstSnapshot.context?.[stepId3]?.status).toBe('waiting');
        expect(secondSnapshot.context?.[stepId2]?.status).toBe('running');
      });

      it('handles pagination', async () => {
        const workflowName1 = 'page_test_1';
        const workflowName2 = 'page_test_2';
        const workflowName3 = 'page_test_3';

        const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('completed');
        const { snapshot: workflow2, runId: runId2, stepId: stepId2 } = createSampleWorkflowSnapshot('running');
        const { snapshot: workflow3, runId: runId3, stepId: stepId3 } = createSampleWorkflowSnapshot('waiting');

        await storage.persistWorkflowSnapshot({ workflowName: workflowName1, runId: runId1, snapshot: workflow1 });
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
        await storage.persistWorkflowSnapshot({ workflowName: workflowName2, runId: runId2, snapshot: workflow2 });
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
        await storage.persistWorkflowSnapshot({ workflowName: workflowName3, runId: runId3, snapshot: workflow3 });

        // Get first page
        const page1 = await storage.getWorkflowRuns({ limit: 2, offset: 0 });
        expect(page1.runs).toHaveLength(2);
        expect(page1.total).toBe(3); // Total count of all records
        expect(page1.runs[0]!.workflowName).toBe(workflowName3);
        expect(page1.runs[1]!.workflowName).toBe(workflowName2);
        const firstSnapshot = page1.runs[0]!.snapshot as WorkflowRunState;
        const secondSnapshot = page1.runs[1]!.snapshot as WorkflowRunState;
        expect(firstSnapshot.context?.[stepId3]?.status).toBe('waiting');
        expect(secondSnapshot.context?.[stepId2]?.status).toBe('running');

        // Get second page
        const page2 = await storage.getWorkflowRuns({ limit: 2, offset: 2 });
        expect(page2.runs).toHaveLength(1);
        expect(page2.total).toBe(3);
        expect(page2.runs[0]!.workflowName).toBe(workflowName1);
        const snapshot = page2.runs[0]!.snapshot as WorkflowRunState;
        expect(snapshot.context?.[stepId1]?.status).toBe('completed');
      });
    });

    describe('getWorkflowRunById', () => {
      const workflowName = 'workflow-id-test';
      let runId: string;
      let stepId: string;

      beforeEach(async () => {
        // Insert a workflow run for positive test
        const sample = createSampleWorkflowSnapshot('success');
        runId = sample.runId;
        stepId = sample.stepId;
        await storage.insert({
          tableName: TABLE_WORKFLOW_SNAPSHOT,
          record: {
            workflow_name: workflowName,
            run_id: runId,
            resourceId: 'resource-abc',
            snapshot: sample.snapshot,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      });

      it('should retrieve a workflow run by ID', async () => {
        const found = await storage.getWorkflowRunById({
          runId,
          workflowName,
        });
        expect(found).not.toBeNull();
        expect(found?.runId).toBe(runId);
        checkWorkflowSnapshot(found?.snapshot!, stepId, 'success');
      });

      it('should return null for non-existent workflow run ID', async () => {
        const notFound = await storage.getWorkflowRunById({
          runId: 'non-existent-id',
          workflowName,
        });
        expect(notFound).toBeNull();
      });
    });

    describe('getWorkflowRuns with resourceId', () => {
      const workflowName = 'workflow-id-test';
      let resourceId: string;
      let runIds: string[] = [];

      beforeEach(async () => {
        // Insert multiple workflow runs for the same resourceId
        resourceId = 'resource-shared';
        for (const status of ['success', 'failed']) {
          const sample = createSampleWorkflowSnapshot(status as WorkflowRunState['context'][string]['status']);
          runIds.push(sample.runId);
          await storage.insert({
            tableName: TABLE_WORKFLOW_SNAPSHOT,
            record: {
              workflow_name: workflowName,
              run_id: sample.runId,
              resourceId,
              snapshot: sample.snapshot,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }
        // Insert a run with a different resourceId
        const other = createSampleWorkflowSnapshot('waiting');
        await storage.insert({
          tableName: TABLE_WORKFLOW_SNAPSHOT,
          record: {
            workflow_name: workflowName,
            run_id: other.runId,
            resourceId: 'resource-other',
            snapshot: other.snapshot,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      });

      it('should retrieve all workflow runs by resourceId', async () => {
        const { runs } = await storage.getWorkflowRuns({
          resourceId,
          workflowName,
        });
        expect(Array.isArray(runs)).toBe(true);
        expect(runs.length).toBeGreaterThanOrEqual(2);
        for (const run of runs) {
          expect(run.resourceId).toBe(resourceId);
        }
      });

      it('should return an empty array if no workflow runs match resourceId', async () => {
        const { runs } = await storage.getWorkflowRuns({
          resourceId: 'non-existent-resource',
          workflowName,
        });
        expect(Array.isArray(runs)).toBe(true);
        expect(runs.length).toBe(0);
      });
    });

    it('should store valid ISO date strings for createdAt and updatedAt in workflow runs', async () => {
      // Use the storage instance from the test context
      const workflowName = 'test-workflow';
      const runId = 'test-run-id';
      const snapshot = {
        runId,
        value: {},
        context: {},
        activePaths: [],
        suspendedPaths: {},
        serializedStepGraph: [],
        timestamp: Date.now(),
        status: 'success' as WorkflowRunState['status'],
      };
      await storage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot,
      });
      // Fetch the row directly from the database
      const run = await storage.getWorkflowRunById({ workflowName, runId });
      expect(run).toBeTruthy();
      // Check that these are valid Date objects
      expect(run?.createdAt instanceof Date).toBe(true);
      expect(run?.updatedAt instanceof Date).toBe(true);
      expect(!isNaN(run!.createdAt.getTime())).toBe(true);
      expect(!isNaN(run!.updatedAt.getTime())).toBe(true);
    });

    it('getWorkflowRuns should return valid createdAt and updatedAt', async () => {
      // Use the storage instance from the test context
      const workflowName = 'test-workflow';
      const runId = 'test-run-id-2';
      const snapshot = {
        runId,
        value: {},
        context: {},
        activePaths: [],
        suspendedPaths: {},
        serializedStepGraph: [],
        timestamp: Date.now(),
        status: 'success' as WorkflowRunState['status'],
      };
      await storage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot,
      });

      const { runs } = await storage.getWorkflowRuns({ workflowName });
      expect(runs.length).toBeGreaterThan(0);
      const run = runs.find(r => r.runId === runId);
      expect(run).toBeTruthy();
      expect(run?.createdAt instanceof Date).toBe(true);
      expect(run?.updatedAt instanceof Date).toBe(true);
      expect(!isNaN(run!.createdAt.getTime())).toBe(true);
      expect(!isNaN(run!.updatedAt.getTime())).toBe(true);
    });
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
