import { WorkflowRunState } from '@mastra/core';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { PostgresStore, type PostgresConfig } from './index';

const TEST_CONFIG: PostgresConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5433'),
  database: process.env.POSTGRES_DB || 'mastra',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
};

const TEST_TABLE = 'test_workflow_snapshots';

describe('PostgresStore', () => {
  let store: PostgresStore;

  beforeAll(async () => {
    store = new PostgresStore(TEST_CONFIG);
    await store.init(TEST_TABLE);
  });

  afterAll(async () => {
    await store.close();
  });

  beforeEach(async () => {
    // Clean up the test table before each test
    await store.clearTable(TEST_TABLE);
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
    await store.persistWorkflowSnapshot(testData);

    // Test loading the persisted data
    const loadedData = await store.loadWorkflowSnapshot({
      tableName: TEST_TABLE,
      workflowName: testData.workflowName,
      runId: testData.runId,
    });

    expect(loadedData).toEqual(mockSnapshot);
  });

  it('should return null when loading non-existent snapshot', async () => {
    const loadedData = await store.loadWorkflowSnapshot({
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
    await store.persistWorkflowSnapshot({
      ...key,
      snapshot: baseSnapshot,
    });

    // Second persist with same key
    await store.persistWorkflowSnapshot({
      ...key,
      snapshot: updatedSnapshot,
    });

    // Load and verify it was updated
    const loadedData = await store.loadWorkflowSnapshot(key);
    expect(loadedData).toEqual(updatedSnapshot);
  });
});
