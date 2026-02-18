import { describe, it, expect, beforeAll, inject } from 'vitest';
import { MastraClient } from '@mastra/client-js';

export interface WorkflowTestConfig {
  testNameSuffix?: string;
  workflowId?: string;
}

export function createWorkflowTests(config: WorkflowTestConfig = {}) {
  const { testNameSuffix, workflowId = 'add-workflow' } = config;
  const suiteName = testNameSuffix
    ? `Workflow Client JS E2E Tests (${testNameSuffix})`
    : 'Workflow Client JS E2E Tests';

  let client: MastraClient;

  describe(suiteName, () => {
    beforeAll(async () => {
      const baseUrl = inject('baseUrl');
      client = new MastraClient({ baseUrl, retries: 0 });
    });

    describe('listWorkflows', () => {
      it('should return a record of workflows', async () => {
        const workflows = await client.listWorkflows();
        expect(workflows).toBeDefined();
        expect(typeof workflows).toBe('object');
        expect(workflows[workflowId]).toBeDefined();
      });
    });

    describe('getWorkflow', () => {
      it('should return workflow details', async () => {
        const workflow = client.getWorkflow(workflowId);
        const details = await workflow.details();
        expect(details).toBeDefined();
        expect(details.name).toBe(workflowId);
      });

      it('should throw for non-existent workflow', async () => {
        const workflow = client.getWorkflow('nonexistent-workflow');
        await expect(workflow.details()).rejects.toThrow();
      });
    });

    describe('createRun and startAsync', () => {
      it('should create a run and return a run ID', async () => {
        const workflow = client.getWorkflow(workflowId);
        const run = await workflow.createRun();
        expect(run).toBeDefined();
        expect(run.runId).toBeDefined();
        expect(typeof run.runId).toBe('string');
      });

      it('should execute workflow and return result', async () => {
        const workflow = client.getWorkflow(workflowId);
        const run = await workflow.createRun();
        const result = await run.startAsync({
          inputData: { a: 5, b: 3 },
        });
        expect(result).toBeDefined();
        expect(result.status).toBe('success');
        if (result.status === 'success') {
          expect(result.result).toEqual({ result: 8 });
        }
      });

      it('should execute workflow with different inputs', async () => {
        const workflow = client.getWorkflow(workflowId);
        const run = await workflow.createRun();
        const result = await run.startAsync({
          inputData: { a: -10, b: 25 },
        });
        expect(result).toBeDefined();
        expect(result.status).toBe('success');
        if (result.status === 'success') {
          expect(result.result).toEqual({ result: 15 });
        }
      });
    });

    describe('workflow runs', () => {
      it('should list runs for a workflow', async () => {
        // Execute a workflow first
        const workflow = client.getWorkflow(workflowId);
        const run = await workflow.createRun();
        await run.startAsync({ inputData: { a: 1, b: 2 } });

        const runsResponse = await workflow.runs();
        expect(runsResponse).toBeDefined();
        expect(runsResponse.runs).toBeDefined();
        expect(Array.isArray(runsResponse.runs)).toBe(true);
        expect(runsResponse.runs.length).toBeGreaterThan(0);
        // Verify the most recent run has the expected snapshot
        const latestRun = runsResponse.runs[0];
        expect(latestRun).toBeDefined();
        expect(latestRun.runId).toBeDefined();
        const snapshot = typeof latestRun.snapshot === 'string' ? JSON.parse(latestRun.snapshot) : latestRun.snapshot;
        expect(snapshot.status).toBe('success');
        expect(snapshot.result).toEqual({ result: 3 });
      });

      it('should get a specific run by ID', async () => {
        const workflow = client.getWorkflow(workflowId);
        const run = await workflow.createRun();
        await run.startAsync({ inputData: { a: 7, b: 8 } });

        const runDetails = await workflow.runById(run.runId);
        expect(runDetails).toBeDefined();
        expect(runDetails.runId).toBe(run.runId);
      });
    });
  });
}
