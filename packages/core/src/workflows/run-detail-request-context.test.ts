import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import { createWorkflow } from './create';
import { createStep } from './workflow';

describe('getWorkflowRunById requestContext field', () => {
  it('projects the persisted request context without the reserved Mastra keys', async () => {
    const step = createStep({
      id: 'noop',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => ({}),
    });
    const workflow = createWorkflow({ id: 'run-detail-wf', inputSchema: z.object({}), outputSchema: z.object({}) })
      .then(step)
      .commit();
    const storage = new InMemoryStore();
    new Mastra({ workflows: { workflow }, storage, logger: false });
    const workflows = (await storage.getStore('workflows'))!;
    await workflows.persistWorkflowSnapshot({
      workflowName: workflow.id,
      runId: 'run-1',
      snapshot: {
        runId: 'run-1',
        status: 'suspended',
        value: {},
        context: {},
        activePaths: [],
        serializedStepGraph: [],
        suspendedPaths: {},
        waitingPaths: {},
        timestamp: Date.now(),
        requestContext: {
          tenant: 'acme',
          mastra__resourceId: 'user-1',
          mastra__durableExecutions: { 'run-1': { executionId: 'exec-1' } },
          __mastra_requireToolApproval: true,
        },
      } as never,
    });

    const detail = await workflow.getWorkflowRunById('run-1', { fields: ['requestContext'] });
    expect(detail?.requestContext).toEqual({ tenant: 'acme' });
  });
});
