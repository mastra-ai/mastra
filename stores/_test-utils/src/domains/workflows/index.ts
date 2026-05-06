import type { MastraStorage, WorkflowsStorage } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, it, expect, beforeEach } from 'vitest';
import { checkWorkflowSnapshot, createSampleWorkflowSnapshot } from './data';

export interface WorkflowsTestOptions {
  storage: MastraStorage;
}

export function createWorkflowsTests({ storage }: WorkflowsTestOptions) {
  let workflowsStorage: WorkflowsStorage;
  let supportsConcurrentUpdates: boolean;

  beforeAll(async () => {
    const store = await storage.getStore('workflows');
    if (!store) {
      throw new Error('Workflows storage not found');
    }
    workflowsStorage = store;
    supportsConcurrentUpdates = workflowsStorage.supportsConcurrentUpdates();
  });

  describe('listWorkflowRuns', () => {
    beforeEach(async () => {
      await workflowsStorage.dangerouslyClearAll();
    });
    it('returns empty array when no workflows exist', async () => {
      const { runs, total } = await workflowsStorage.listWorkflowRuns();
      expect(runs).toEqual([]);
      expect(total).toBe(0);
    });

    it('returns all workflows by default', async () => {
      const workflowName1 = 'default_test_1';
      const workflowName2 = 'default_test_2';

      const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('completed');
      const { snapshot: workflow2, runId: runId2, stepId: stepId2 } = createSampleWorkflowSnapshot('running');

      await workflowsStorage.persistWorkflowSnapshot({
        workflowName: workflowName1,
        runId: runId1,
        snapshot: workflow1,
      });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await workflowsStorage.persistWorkflowSnapshot({
        workflowName: workflowName2,
        runId: runId2,
        snapshot: workflow2,
      });

      const { runs, total } = await workflowsStorage.listWorkflowRuns();

      const wfRun2 = runs.find(r => r.workflowName === workflowName2);
      const wfRun1 = runs.find(r => r.workflowName === workflowName1);
      expect(wfRun2).toBeDefined();
      expect(wfRun1).toBeDefined();

      expect(runs).toHaveLength(2);
      expect(total).toBe(2);

      const firstSnapshot = wfRun1!.snapshot as WorkflowRunState;
      const secondSnapshot = wfRun2!.snapshot as WorkflowRunState;
      expect(firstSnapshot.context?.[stepId1]?.status).toBe('completed');
      expect(secondSnapshot.context?.[stepId2]?.status).toBe('running');
    });

    it('filters by workflow name', async () => {
      const workflowName1 = 'filter_test_1';
      const workflowName2 = 'filter_test_2';

      const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('completed');
      const { snapshot: workflow2, runId: runId2 } = createSampleWorkflowSnapshot('failed');

      await workflowsStorage.persistWorkflowSnapshot({
        workflowName: workflowName1,
        runId: runId1,
        snapshot: workflow1,
      });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await workflowsStorage.persistWorkflowSnapshot({
        workflowName: workflowName2,
        runId: runId2,
        snapshot: workflow2,
      });

      const { runs, total } = await workflowsStorage.listWorkflowRuns({ workflowName: workflowName1 });
      expect(runs).toHaveLength(1);
      expect(total).toBe(1);
      expect(runs[0]!.workflowName).toBe(workflowName1);
      const snapshot = runs[0]!.snapshot as WorkflowRunState;
      expect(snapshot.context?.[stepId1]?.status).toBe('completed');
    });

    it('filters by status', async () => {
      const workflowName1 = 'filter_test_1';
      const workflowName2 = 'filter_test_2';

      const { snapshot: workflow1, runId: runId1, stepId: stepId1 } = createSampleWorkflowSnapshot('success');
      const { snapshot: workflow2, runId: runId2 } = createSampleWorkflowSnapshot('failed');

      await workflowsStorage.persistWorkflowSnapshot({
        workflowName: workflowName1,
        runId: runId1,
        snapshot: workflow1,
      });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await workflowsStorage.persistWorkflowSnapshot({
        workflowName: workflowName2,
        runId: runId2,
        snapshot: workflow2,
      });

      const { runs, total } = await workflowsStorage.listWorkflowRuns({ status: 'success' });
      expect(runs).toHaveLength(1);
      expect(total).toBe(1);
      expect(runs[0]!.workflowName).toBe(workflowName1);
      const snapshot = runs[0]!.snapshot as WorkflowRunState;
      expect(snapshot.status).toBe('success');
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

      await workflowsStorage.persistWorkflowSnapshot({
        workflowName: workflowName1,
        runId: runId1,
        snapshot: workflow1,
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
      });
      await workflowsStorage.persistWorkflowSnapshot({
        workflowName: workflowName2,
        runId: runId2,
        snapshot: workflow2,
        createdAt: yesterday,
        updatedAt: yesterday,
      });
      await workflowsStorage.persistWorkflowSnapshot({
        workflowName: workflowName3,
        runId: runId3,
        snapshot: workflow3,
        createdAt: now,
        updatedAt: now,
      });

      const { runs } = await workflowsStorage.listWorkflowRuns({
        fromDate: yesterday,
        toDate: now,
      });

      expect(runs).toHaveLength(2);
      const wfName3Run = runs.find(r => r.workflowName === workflowName3);
      const wfName2Run = runs.find(r => r.workflowName === workflowName2);
      expect(wfName3Run).toBeDefined();
      expect(wfName2Run).toBeDefined();
      const firstSnapshot = wfName3Run!.snapshot as WorkflowRunState;
      const secondSnapshot = wfName2Run!.snapshot as WorkflowRunState;
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

      await workflowsStorage.persistWorkflowSnapshot({
        workflowName: workflowName1,
        runId: runId1,
        snapshot: workflow1,
      });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await workflowsStorage.persistWorkflowSnapshot({
        workflowName: workflowName2,
        runId: runId2,
        snapshot: workflow2,
      });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await workflowsStorage.persistWorkflowSnapshot({
        workflowName: workflowName3,
        runId: runId3,
        snapshot: workflow3,
      });

      // Get first page
      const page1 = await workflowsStorage.listWorkflowRuns({ perPage: 2, page: 0 });

      expect(page1.runs).toHaveLength(2);
      expect(page1.total).toBe(3); // Total count of all records

      // Get second page
      const page2 = await workflowsStorage.listWorkflowRuns({ perPage: 2, page: 1 });
      expect(page2.runs).toHaveLength(1);
      expect(page2.total).toBe(3);
    });
  });

  describe('getWorkflowRunById and deleteWorkflowRunById', () => {
    const workflowName = 'workflow-id-test';
    let runId: string;
    let stepId: string;

    beforeEach(async () => {
      // Insert a workflow run for positive test
      const sample = createSampleWorkflowSnapshot('success');
      runId = sample.runId;
      stepId = sample.stepId;
      await workflowsStorage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: sample.snapshot,
      });
    });

    it('should retrieve a workflow run by ID', async () => {
      const found = await workflowsStorage.getWorkflowRunById({
        runId,
        workflowName,
      });
      expect(found).not.toBeNull();
      expect(found?.runId).toBe(runId);
      checkWorkflowSnapshot(found?.snapshot!, stepId, 'success');
    });

    it('should delete a workflow run by ID', async () => {
      const found = await workflowsStorage.getWorkflowRunById({
        runId,
        workflowName,
      });
      expect(found).not.toBeNull();
      expect(found?.runId).toBe(runId);
      checkWorkflowSnapshot(found?.snapshot!, stepId, 'success');

      await workflowsStorage.deleteWorkflowRunById({
        runId,
        workflowName,
      });
      const deleted = await workflowsStorage.getWorkflowRunById({
        runId,
        workflowName,
      });
      expect(deleted).toBeNull();
    });

    it('should return null for non-existent workflow run ID', async () => {
      const notFound = await workflowsStorage.getWorkflowRunById({
        runId: 'non-existent-id',
        workflowName,
      });
      expect(notFound).toBeNull();
    });
  });

  describe('listWorkflowRuns with resourceId', () => {
    const workflowName = 'workflow-id-test';
    let resourceId: string;
    let runIds: string[] = [];

    beforeEach(async () => {
      // Insert multiple workflow runs for the same resourceId
      resourceId = 'resource-shared';
      for (const status of ['success', 'failed']) {
        const sample = createSampleWorkflowSnapshot(status as WorkflowRunState['context'][string]['status']);
        runIds.push(sample.runId);
        await workflowsStorage.persistWorkflowSnapshot({
          workflowName,
          runId: sample.runId,
          resourceId,
          snapshot: sample.snapshot,
        });
      }
      // Insert a run with a different resourceId
      const other = createSampleWorkflowSnapshot('waiting');
      await workflowsStorage.persistWorkflowSnapshot({
        workflowName,
        runId: other.runId,
        resourceId: 'resource-other',
        snapshot: other.snapshot,
      });
    });

    it('should retrieve all workflow runs by resourceId', async () => {
      const { runs } = await workflowsStorage.listWorkflowRuns({
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
      const { runs } = await workflowsStorage.listWorkflowRuns({
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
      status: 'success' as WorkflowRunState['status'],
      value: {},
      context: {},
      activePaths: [],
      activeStepsPath: {},
      suspendedPaths: {},
      resumeLabels: {},
      serializedStepGraph: [],
      waitingPaths: {},
      timestamp: Date.now(),
    };
    await workflowsStorage.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot,
    });
    // Fetch the row directly from the database
    const run = await workflowsStorage.getWorkflowRunById({ workflowName, runId });
    expect(run).toBeTruthy();
    // Check that these are valid Date objects
    expect(run?.createdAt instanceof Date).toBe(true);
    expect(run?.updatedAt instanceof Date).toBe(true);
    expect(!isNaN(run!.createdAt.getTime())).toBe(true);
    expect(!isNaN(run!.updatedAt.getTime())).toBe(true);
  });

  it('listWorkflowRuns should return valid createdAt and updatedAt', async () => {
    // Use the storage instance from the test context
    const workflowName = 'test-workflow';
    const runId = 'test-run-id-2';
    const snapshot = {
      runId,
      status: 'success' as WorkflowRunState['status'],
      value: {},
      context: {},
      activePaths: [],
      activeStepsPath: {},
      suspendedPaths: {},
      resumeLabels: {},
      serializedStepGraph: [],
      waitingPaths: {},
      timestamp: Date.now(),
    };
    await workflowsStorage.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot,
    });

    const { runs } = await workflowsStorage.listWorkflowRuns({ workflowName });
    expect(runs.length).toBeGreaterThan(0);
    const run = runs.find(r => r.runId === runId);
    expect(run).toBeTruthy();
    expect(run?.createdAt instanceof Date).toBe(true);
    expect(run?.updatedAt instanceof Date).toBe(true);
    expect(!isNaN(run!.createdAt.getTime())).toBe(true);
    expect(!isNaN(run!.updatedAt.getTime())).toBe(true);
  });

  describe('Workflow Snapshots', () => {
    it('should persist and load workflow snapshots', async () => {
      const workflowName = 'test-workflow';
      const runId = `run-${randomUUID()}`;
      const snapshot = {
        status: 'running',
        context: {
          stepResults: {},
          attempts: {},
          triggerData: { type: 'manual' },
        },
      } as any;

      await workflowsStorage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot,
      });

      const loadedSnapshot = await workflowsStorage.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(snapshot);
    });

    it('should return null for non-existent workflow snapshot', async () => {
      const result = await workflowsStorage.loadWorkflowSnapshot({
        workflowName: 'non-existent',
        runId: 'non-existent',
      });

      expect(result).toBeNull();
    });

    it('should update existing workflow snapshot', async () => {
      const workflowName = 'test-workflow';
      const runId = `run-${randomUUID()}`;
      const initialSnapshot = {
        status: 'running',
        context: {
          stepResults: {},
          attempts: {},
          triggerData: { type: 'manual' },
        },
      };

      await workflowsStorage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: initialSnapshot as any,
      });

      const updatedSnapshot = {
        status: 'completed',
        context: {
          stepResults: {
            'step-1': { status: 'success', result: { data: 'test' } },
          },
          attempts: { 'step-1': 1 },
          triggerData: { type: 'manual' },
        },
      } as any;

      await workflowsStorage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: updatedSnapshot,
      });

      const loadedSnapshot = await workflowsStorage.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(updatedSnapshot);
    });

    it('should handle complex workflow state', async () => {
      const workflowName = 'complex-workflow';
      const runId = `run-${randomUUID()}`;
      const complexSnapshot = {
        value: { currentState: 'running' },
        context: {
          stepResults: {
            'step-1': {
              status: 'success',
              result: {
                nestedData: {
                  array: [1, 2, 3],
                  object: { key: 'value' },
                  date: new Date().toISOString(),
                },
              },
            },
            'step-2': {
              status: 'waiting',
              dependencies: ['step-3', 'step-4'],
            },
          },
          attempts: { 'step-1': 1, 'step-2': 0 },
          triggerData: {
            type: 'scheduled',
            metadata: {
              schedule: '0 0 * * *',
              timezone: 'UTC',
            },
          },
        },
        activePaths: [
          {
            stepPath: ['step-1'],
            stepId: 'step-1',
            status: 'success',
          },
          {
            stepPath: ['step-2'],
            stepId: 'step-2',
            status: 'waiting',
          },
        ],
        runId: runId,
        timestamp: Date.now(),
      };

      await workflowsStorage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: complexSnapshot as unknown as WorkflowRunState,
      });

      const loadedSnapshot = await workflowsStorage.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(complexSnapshot);
    });

    it('should persist resourceId when creating workflow runs', async () => {
      const workflowName = 'test-workflow';
      const runId = `run-${randomUUID()}`;
      const resourceId = `resource-${randomUUID()}`;
      const snapshot = {
        status: 'running',
        context: {},
      } as any;

      await workflowsStorage.persistWorkflowSnapshot({
        workflowName,
        runId,
        resourceId,
        snapshot,
      });

      const run = await workflowsStorage.getWorkflowRunById({
        runId,
        workflowName,
      });

      expect(run?.resourceId).toBe(resourceId);

      expect(run?.snapshot).toEqual(snapshot);
      expect(run?.workflowName).toBe(workflowName);
      expect(run?.runId).toBe(runId);
    });

    it('should update workflow results in snapshot', async () => {
      if (!supportsConcurrentUpdates) {
        console.log('Skipping workflow state updates sequentially test');
        return;
      }
      const workflowName = 'test-workflow';
      const runId = `run-${randomUUID()}`;
      const snapshot = {
        status: 'running',
        context: {},
      } as any;

      await workflowsStorage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot,
      });

      const updatedSnapshot = await workflowsStorage.updateWorkflowResults({
        workflowName,
        runId,
        stepId: 'step-1',
        result: {
          status: 'success',
          output: { data: 'test' },
          payload: { data: 'test' },
          startedAt: Date.now(),
          endedAt: Date.now(),
        },
        requestContext: {
          test: 'test',
        },
      });

      expect(updatedSnapshot).toEqual({
        'step-1': {
          status: 'success',
          output: { data: 'test' },
          payload: { data: 'test' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      await workflowsStorage.updateWorkflowResults({
        workflowName,
        runId,
        stepId: 'step-1',
        result: {
          status: 'success',
          output: { data: 'test!' },
          payload: { data: 'test' },
          startedAt: Date.now(),
          endedAt: Date.now(),
        },
        requestContext: { test: 'test' },
      });

      await workflowsStorage.updateWorkflowResults({
        workflowName,
        runId,
        stepId: 'step-2',
        result: {
          status: 'success',
          output: { data: 'test2' },
          payload: { data: 'test' },
          startedAt: Date.now(),
          endedAt: Date.now(),
        },
        requestContext: { test2: 'test' },
      });

      const finalSnapshot = await workflowsStorage.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

      expect(finalSnapshot?.context).toEqual({
        'step-1': {
          status: 'success',
          output: { data: 'test!' },
          payload: { data: 'test' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        'step-2': {
          status: 'success',
          output: { data: 'test2' },
          payload: { data: 'test' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });
    });

    it('should update workflow state sequentially', async () => {
      if (!supportsConcurrentUpdates) {
        console.log('Skipping workflow state updates sequentially test');
        return;
      }
      const workflowName = 'test-workflow';
      const runId = `run-${randomUUID()}`;
      const snapshot = {
        status: 'running',
        context: { initialStep: { status: 'success' } },
        activePaths: [],
        timestamp: Date.now(),
      } as any;

      await workflowsStorage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot,
      });

      // First update - add waitingPaths
      const firstUpdate = await workflowsStorage.updateWorkflowState({
        workflowName,
        runId,
        opts: {
          status: 'suspended',
          waitingPaths: {
            path1: [0, 1],
          },
        },
      });

      expect(firstUpdate?.status).toBe('suspended');
      expect(firstUpdate?.waitingPaths).toEqual({ path1: [0, 1] });
      expect(firstUpdate?.context).toEqual({ initialStep: { status: 'success' } });

      // Second update - add result and change status
      const secondUpdate = await workflowsStorage.updateWorkflowState({
        workflowName,
        runId,
        opts: {
          status: 'success',
          result: {
            status: 'success',
            output: { finalData: 'completed' },
            payload: { input: 'test' },
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
        },
      });

      expect(secondUpdate?.status).toBe('success');
      expect(secondUpdate?.result?.output).toEqual({ finalData: 'completed' });
      // Previous update should still be present
      expect(secondUpdate?.waitingPaths).toEqual({ path1: [0, 1] });

      // Verify final state in storage
      const finalSnapshot = await workflowsStorage.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

      expect(finalSnapshot?.status).toBe('success');
      expect(finalSnapshot?.waitingPaths).toEqual({ path1: [0, 1] });
      expect(finalSnapshot?.result?.output).toEqual({ finalData: 'completed' });
      expect(finalSnapshot?.context).toEqual({ initialStep: { status: 'success' } });
    });

    it('should return undefined when updating non-existent workflow state', async () => {
      if (!supportsConcurrentUpdates) {
        console.log('Skipping return undefined when updating non-existent workflow state test');
        return;
      }
      const result = await workflowsStorage.updateWorkflowState({
        workflowName: 'non-existent-workflow',
        runId: `run-${randomUUID()}`,
        opts: {
          status: 'success',
        },
      });

      expect(result).toBeUndefined();
    });

    // This test requires atomic transactions for concurrent updates.
    // Stores without transaction support (e.g., LanceDB) may fail this test
    // due to race conditions in the read-modify-write pattern.
    it('should handle concurrent workflow results updates atomically', async () => {
      if (!supportsConcurrentUpdates) {
        console.log('Skipping concurrent workflow results updates atomically test');
        return;
      }
      const workflowName = 'test-workflow';
      const runId = `run-${randomUUID()}`;
      const snapshot = {
        status: 'running',
        context: {},
      } as any;

      await workflowsStorage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot,
      });

      // Simulate concurrent step completions - multiple steps finishing at the same time
      // Without atomic transactions, one step's result may overwrite another's
      await Promise.all([
        workflowsStorage.updateWorkflowResults({
          workflowName,
          runId,
          stepId: 'step-a',
          result: {
            status: 'success',
            output: { data: 'result-a' },
            payload: { input: 'a' },
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
          requestContext: { stepA: true },
        }),
        workflowsStorage.updateWorkflowResults({
          workflowName,
          runId,
          stepId: 'step-b',
          result: {
            status: 'success',
            output: { data: 'result-b' },
            payload: { input: 'b' },
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
          requestContext: { stepB: true },
        }),
        workflowsStorage.updateWorkflowResults({
          workflowName,
          runId,
          stepId: 'step-c',
          result: {
            status: 'success',
            output: { data: 'result-c' },
            payload: { input: 'c' },
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
          requestContext: { stepC: true },
        }),
      ]);

      const finalSnapshot = await workflowsStorage.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

      // All three step results should be present in the final snapshot
      // If any are missing, the store lacks proper atomicity for concurrent updates
      expect(finalSnapshot?.context).toEqual({
        'step-a': {
          status: 'success',
          output: { data: 'result-a' },
          payload: { input: 'a' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        'step-b': {
          status: 'success',
          output: { data: 'result-b' },
          payload: { input: 'b' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
        'step-c': {
          status: 'success',
          output: { data: 'result-c' },
          payload: { input: 'c' },
          startedAt: expect.any(Number),
          endedAt: expect.any(Number),
        },
      });

      // All request contexts should be merged
      expect(finalSnapshot?.requestContext).toEqual(
        expect.objectContaining({
          stepA: true,
          stepB: true,
          stepC: true,
        }),
      );
    });

    // This test requires atomic transactions for concurrent updates.
    // Stores without transaction support (e.g., LanceDB) may fail this test
    // due to race conditions in the read-modify-write pattern.
    it('should handle concurrent workflow state updates atomically', async () => {
      if (!supportsConcurrentUpdates) {
        console.log('Skipping concurrent workflow state updates atomically test');
        return;
      }
      const workflowName = 'test-workflow';
      const runId = `run-${randomUUID()}`;
      const snapshot = {
        status: 'running',
        context: {},
      } as any;

      await workflowsStorage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot,
      });

      // Simulate concurrent updates from multiple workflow steps completing at the same time
      // Without atomic transactions, one update may overwrite the other's changes
      await Promise.all([
        workflowsStorage.updateWorkflowState({
          workflowName,
          runId,
          opts: {
            status: 'success',
            waitingPaths: {
              test: [0],
            },
          },
        }),
        workflowsStorage.updateWorkflowState({
          workflowName,
          runId,
          opts: {
            status: 'success',
            result: {
              status: 'success',
              output: { data: 'test2' },
              payload: { data: 'test' },
              startedAt: Date.now(),
              endedAt: Date.now(),
            },
          },
        }),
      ]);

      const finalSnapshot = await workflowsStorage.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

      // Both updates should be present in the final snapshot
      // If either is missing, the store lacks proper atomicity for concurrent updates
      expect(finalSnapshot?.result).toEqual({
        status: 'success',
        output: { data: 'test2' },
        payload: { data: 'test' },
        startedAt: expect.any(Number),
        endedAt: expect.any(Number),
      });
      expect(finalSnapshot?.waitingPaths).toEqual({
        test: [0],
      });
    });
  });
}
