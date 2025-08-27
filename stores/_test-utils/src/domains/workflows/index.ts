import { MastraStorage, TABLE_WORKFLOW_SNAPSHOT } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { checkWorkflowSnapshot, createSampleWorkflowSnapshot } from './data';

export function createWorkflowsTests({ storage }: { storage: MastraStorage }) {
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

      await storage.persistWorkflowSnapshot({ workflowName: workflowName1, runId: runId1, snapshot: workflow1 });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await storage.persistWorkflowSnapshot({ workflowName: workflowName2, runId: runId2, snapshot: workflow2 });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure different timestamps
      await storage.persistWorkflowSnapshot({ workflowName: workflowName3, runId: runId3, snapshot: workflow3 });

      // Get first page
      const page1 = await storage.getWorkflowRuns({ limit: 2, offset: 0 });

      expect(page1.runs).toHaveLength(2);
      expect(page1.total).toBe(3); // Total count of all records

      // Get second page
      const page2 = await storage.getWorkflowRuns({ limit: 2, offset: 2 });
      expect(page2.runs).toHaveLength(1);
      expect(page2.total).toBe(3);
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
      await storage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: sample.snapshot,
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
      waitingPaths: {},
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
      waitingPaths: {},
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

      await storage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot,
      });

      const loadedSnapshot = await storage.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(snapshot);
    });

    it('should return null for non-existent workflow snapshot', async () => {
      const result = await storage.loadWorkflowSnapshot({
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

      await storage.persistWorkflowSnapshot({
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

      await storage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: updatedSnapshot,
      });

      const loadedSnapshot = await storage.loadWorkflowSnapshot({
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

      await storage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: complexSnapshot as unknown as WorkflowRunState,
      });

      const loadedSnapshot = await storage.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

      expect(loadedSnapshot).toEqual(complexSnapshot);
    });

    // implement on other stores
    it.todo('should update workflow results in snapshot', async () => {
      const workflowName = 'test-workflow';
      const runId = `run-${randomUUID()}`;
      const snapshot = {
        status: 'running',
        context: {},
      } as any;

      await storage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot,
      });

      const updatedSnapshot = await storage.updateWorkflowResults({
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
        runtimeContext: {
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

      await Promise.all([
        storage.updateWorkflowResults({
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
          runtimeContext: { test: 'test' },
        }),
        storage.updateWorkflowResults({
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
          runtimeContext: { test2: 'test' },
        }),
      ]);

      const finalSnapshot = await storage.loadWorkflowSnapshot({
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

    // implement on other stores
    it.todo('should update workflow state in snapshot', async () => {
      const workflowName = 'test-workflow';
      const runId = `run-${randomUUID()}`;
      const snapshot = {
        status: 'running',
        context: {},
      } as any;

      await storage.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot,
      });

      await Promise.all([
        storage.updateWorkflowState({
          workflowName,
          runId,
          opts: {
            status: 'success',
            waitingPaths: {
              test: [0],
            },
          },
        }),
        storage.updateWorkflowState({
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

      const finalSnapshot = await storage.loadWorkflowSnapshot({
        workflowName,
        runId,
      });

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
