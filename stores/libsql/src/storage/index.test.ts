import { createTestSuite } from '@internal/storage-test-utils';
import { Mastra } from '@mastra/core/mastra';
import { TABLE_WORKFLOW_SNAPSHOT, TABLE_SCHEMAS } from '@mastra/core/storage';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LibSQLStore } from './index';

// Test database configuration
const TEST_DB_URL = 'file::memory:?cache=shared'; // Use in-memory SQLite for tests

const mastra = new Mastra({
  storage: new LibSQLStore({
    url: TEST_DB_URL,
  }),
});

createTestSuite(mastra.getStorage()!);

// Additional test to check createdAt and updatedAt columns
describe('LibSQLStore createdAt/updatedAt columns', () => {
  beforeAll(async () => {
    await mastra.getStorage()!.createTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT],
    });
  });

  afterAll(async () => {
    await mastra.getStorage()!.clearTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
    });
  });

  it('should store valid ISO date strings for createdAt and updatedAt in workflow runs', async () => {
    const storage = mastra.getStorage()!;
    // Simulate a workflow run snapshot with a valid WorkflowRunState
    const workflowName = 'test-workflow';
    const runId = 'test-run-id';
    const snapshot = {
      runId,
      value: {},
      context: {},
      activePaths: [],
      suspendedPaths: {},
      timestamp: Date.now(),
    };
    await storage.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot,
    });
    // Fetch the row directly from the database
    const client = (storage as any).client;
    const result = await client.execute({
      sql: 'SELECT createdAt, updatedAt FROM mastra_workflow_snapshot WHERE workflow_name = ? AND run_id = ?',
      args: [workflowName, runId],
    });
    expect(result.rows).toBeTruthy();
    expect(result.rows.length).toBe(1);
    const { createdAt, updatedAt } = result.rows[0];
    // Check that these are valid ISO date strings
    expect(typeof createdAt).toBe('string');
    expect(typeof updatedAt).toBe('string');
    expect(!isNaN(Date.parse(createdAt))).toBe(true);
    expect(!isNaN(Date.parse(updatedAt))).toBe(true);
  });

  it('getWorkflowRuns should return valid createdAt and updatedAt', async () => {
    const storage = mastra.getStorage()!;
    const workflowName = 'test-workflow';
    const runId = 'test-run-id-2';
    const snapshot = {
      runId,
      value: {},
      context: {},
      activePaths: [],
      suspendedPaths: {},
      timestamp: Date.now(),
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

  it('getWorkflowRunById should return valid createdAt and updatedAt', async () => {
    const storage = mastra.getStorage()!;
    const workflowName = 'test-workflow';
    const runId = 'test-run-id-3';
    const snapshot = {
      runId,
      value: {},
      context: {},
      activePaths: [],
      suspendedPaths: {},
      timestamp: Date.now(),
    };
    await storage.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot,
    });

    const run = await storage.getWorkflowRunById({ workflowName, runId });
    expect(run).toBeTruthy();
    expect(run?.createdAt instanceof Date).toBe(true);
    expect(run?.updatedAt instanceof Date).toBe(true);
    expect(!isNaN(run!.createdAt.getTime())).toBe(true);
    expect(!isNaN(run!.updatedAt.getTime())).toBe(true);
  });
});
