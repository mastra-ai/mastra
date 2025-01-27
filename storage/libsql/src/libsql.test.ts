import { WorkflowRunState } from '@mastra/core';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { LibSQLStorage, type LibSQLConfig } from './index';

const TEST_CONFIG: LibSQLConfig = {
  url: process.env.LIBSQL_URL || 'file:test.db',
  authToken: process.env.LIBSQL_AUTH_TOKEN,
};

const TEST_TABLE = 'test_workflow_snapshots';

describe('LibSQLStorage', () => {
  let storage: LibSQLStorage;

  beforeAll(async () => {
    storage = new LibSQLStorage(TEST_CONFIG);
    await storage.init(TEST_TABLE);
  });

  afterAll(async () => {
    await storage.close();
  });

  beforeEach(async () => {
    // Clean up the test table before each test
    await storage.clearTable(TEST_TABLE);
  });

  it('should persist and load workflow snapshots', async () => {
    const mockSnapshot: WorkflowRunState = {
      value: { step1: 'completed' },
      context: {
        stepResults: {
          step1: { status: 'success', payload: { result: 'done' } },
        },
        attempts: {},
        triggerData: {},
      },
      runId: 'test-run',
      activePaths: [],
      timestamp: Date.now(),
    };

    const testData = {
      tableName: TEST_TABLE,
      workflowName: 'test-workflow',
      runId: 'test-run',
      snapshot: mockSnapshot,
    };

    // Test persisting data
    await storage.persistWorkflowSnapshot(testData);

    // Test loading the persisted data
    const loadedData = await storage.loadWorkflowSnapshot({
      tableName: TEST_TABLE,
      workflowName: testData.workflowName,
      runId: testData.runId,
    });

    expect(loadedData).toEqual(mockSnapshot);
  });

  it('should return null when loading non-existent snapshot', async () => {
    const loadedData = await storage.loadWorkflowSnapshot({
      tableName: TEST_TABLE,
      workflowName: 'non-existent',
      runId: 'non-existent',
    });

    expect(loadedData).toBeNull();
  });

  it('should update existing snapshot when persisting with same key', async () => {
    const baseSnapshot: WorkflowRunState = {
      value: { step1: 'completed' },
      context: {
        stepResults: {
          step1: { status: 'success', payload: { result: 'initial' } },
        },
        attempts: {},
        triggerData: {},
      },
      runId: 'test-run',
      activePaths: [],
      timestamp: Date.now(),
    };

    const updatedSnapshot: WorkflowRunState = {
      ...baseSnapshot,
      context: {
        ...baseSnapshot.context,
        stepResults: {
          step1: { status: 'success', payload: { result: 'updated' } },
        },
      },
    };

    const key = {
      tableName: TEST_TABLE,
      workflowName: 'test-workflow',
      runId: 'test-run',
    };

    // First persist
    await storage.persistWorkflowSnapshot({
      ...key,
      snapshot: baseSnapshot,
    });

    // Second persist with same key
    await storage.persistWorkflowSnapshot({
      ...key,
      snapshot: updatedSnapshot,
    });

    // Load and verify it was updated
    const loadedData = await storage.loadWorkflowSnapshot(key);
    expect(loadedData).toEqual(updatedSnapshot);
  });

  it('should handle concurrent operations correctly', async () => {
    const snapshots = Array.from({ length: 10 }, (_, i) => ({
      value: { [`step${i}`]: 'completed' },
      context: {
        stepResults: {
          [`step${i}`]: { status: 'success', payload: { result: `done${i}` } },
        },
        attempts: {},
        triggerData: {},
      },
      runId: `test-run-${i}`,
      activePaths: [],
      timestamp: Date.now(),
    }));

    // Test concurrent writes
    await Promise.all(
      snapshots.map((snapshot, i) =>
        storage.persistWorkflowSnapshot({
          tableName: TEST_TABLE,
          workflowName: `test-workflow-${i}`,
          runId: `test-run-${i}`,
          snapshot,
        }),
      ),
    );

    // Test concurrent reads
    const results = await Promise.all(
      snapshots.map((_, i) =>
        storage.loadWorkflowSnapshot({
          tableName: TEST_TABLE,
          workflowName: `test-workflow-${i}`,
          runId: `test-run-${i}`,
        }),
      ),
    );

    results.forEach((result, i) => {
      expect(result).toEqual(snapshots[i]);
    });
  });
});
