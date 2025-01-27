import { WorkflowRunState } from '@mastra/core';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { UpstashStore, type UpstashConfig } from './index';

const TEST_CONFIG: UpstashConfig = {
  url: process.env.UPSTASH_REDIS_URL || '',
  token: process.env.UPSTASH_REDIS_TOKEN || '',
};

const TEST_NAMESPACE = 'test_workflow_snapshots';

describe('UpstashStore', () => {
  let store: UpstashStore;

  beforeAll(async () => {
    if (!TEST_CONFIG.url || !TEST_CONFIG.token) {
      throw new Error('Upstash Redis credentials not found in environment variables');
    }
    store = new UpstashStore(TEST_CONFIG);
    await store.init(TEST_NAMESPACE);
  });

  afterAll(async () => {
    await store.close();
  });

  beforeEach(async () => {
    // Clean up the test namespace before each test
    await store.clearNamespace(TEST_NAMESPACE);
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
      namespace: TEST_NAMESPACE,
      workflowName: 'test-workflow',
      runId: 'test-run',
      snapshot: mockSnapshot,
    };

    // Test persisting data
    await store.persistWorkflowSnapshot(testData);

    // Test loading the persisted data
    const loadedData = await store.loadWorkflowSnapshot({
      namespace: TEST_NAMESPACE,
      workflowName: testData.workflowName,
      runId: testData.runId,
    });

    expect(loadedData).toEqual(mockSnapshot);
  });

  it('should return null when loading non-existent snapshot', async () => {
    const loadedData = await store.loadWorkflowSnapshot({
      namespace: TEST_NAMESPACE,
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
      namespace: TEST_NAMESPACE,
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
