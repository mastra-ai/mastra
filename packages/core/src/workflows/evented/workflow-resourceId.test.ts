import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RequestContext, MASTRA_RESOURCE_ID_KEY } from '../../di';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { TABLE_WORKFLOW_SNAPSHOT } from '../../storage';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

const testStorage = new MockStore();

describe('Workflow resourceId', () => {
  let mastra: Mastra | null = null;

  beforeEach(() => {
    vi.resetAllMocks();
    testStorage.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
  });

  afterEach(async () => {
    if (mastra) {
      await mastra.stopEventEngine();
      mastra = null;
    }
    testStorage.clearTable({ tableName: TABLE_WORKFLOW_SNAPSHOT });
  });

  it('should persist resourceId passed to createRun()', async () => {
    const step1 = createStep({
      id: 'step1',
      execute: async () => ({ result: 'success' }),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      steps: [step1],
    });
    workflow.then(step1).commit();

    mastra = new Mastra({
      workflows: { 'test-workflow': workflow },
      storage: testStorage,
      pubsub: new EventEmitterPubSub(),
    });
    await mastra.startEventEngine();

    const runId = 'test-run-id';
    const resourceId = 'user-123';

    const run = await workflow.createRun({
      runId,
      resourceId,
    });

    await run.start({ inputData: {} });

    // Check if resourceId was persisted
    const snapshot = await testStorage.loadWorkflowSnapshot({
      workflowName: 'test-workflow',
      runId,
    });

    expect(snapshot).toBeTruthy();

    // Get the stored workflow run to check resourceId
    const workflowRun = await testStorage.getWorkflowRunById({
      runId,
      workflowName: 'test-workflow',
    });

    expect(workflowRun?.resourceId).toBe(resourceId);
  });

  it('should read resourceId from RequestContext', async () => {
    const step1 = createStep({
      id: 'step1',
      execute: async () => ({ result: 'success' }),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      steps: [step1],
    });
    workflow.then(step1).commit();

    mastra = new Mastra({
      workflows: { 'test-workflow': workflow },
      storage: testStorage,
      pubsub: new EventEmitterPubSub(),
    });
    await mastra.startEventEngine();

    const runId = 'test-run-id';
    const resourceId = 'user-from-context-456';

    const run = await workflow.createRun({ runId });

    // Set resourceId in RequestContext (like middleware would do)
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);

    await run.start({
      inputData: {},
      requestContext,
    });

    // Get the stored workflow run to check resourceId
    const workflowRun = await testStorage.getWorkflowRunById({
      runId,
      workflowName: 'test-workflow',
    });

    expect(workflowRun?.resourceId).toBe(resourceId);
  });

  it('should prioritize RequestContext resourceId over parameter (for security)', async () => {
    const step1 = createStep({
      id: 'step1',
      execute: async () => ({ result: 'success' }),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      steps: [step1],
    });
    workflow.then(step1).commit();

    mastra = new Mastra({
      workflows: { 'test-workflow': workflow },
      storage: testStorage,
      pubsub: new EventEmitterPubSub(),
    });
    await mastra.startEventEngine();

    const runId = 'test-run-id';
    const resourceIdFromParam = 'malicious-user-999'; // Attacker trying to hijack
    const resourceIdFromContext = 'authenticated-user-123'; // Set by secure middleware

    const run = await workflow.createRun({
      runId,
      resourceId: resourceIdFromParam,
    });

    // Middleware sets authenticated user's resourceId
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceIdFromContext);

    await run.start({
      inputData: {},
      requestContext,
    });

    const workflowRun = await testStorage.getWorkflowRunById({
      runId,
      workflowName: 'test-workflow',
    });

    expect(workflowRun?.resourceId).toBe(resourceIdFromContext);
    expect(workflowRun?.resourceId).not.toBe(resourceIdFromParam);
  });

  it('should persist resourceId on workflow resume', async () => {
    const step1 = createStep({
      id: 'step1',
      execute: async ({ suspend }) => {
        return suspend({ reason: 'waiting' });
      },
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
    });

    const workflow = createWorkflow({
      id: 'test-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      steps: [step1],
    });
    workflow.then(step1).commit();

    mastra = new Mastra({
      workflows: { 'test-workflow': workflow },
      storage: testStorage,
      pubsub: new EventEmitterPubSub(),
    });
    await mastra.startEventEngine();

    const runId = 'test-run-id';
    const resourceId = 'user-789';

    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);

    const run = await workflow.createRun({ runId });
    const result = await run.start({
      inputData: {},
      requestContext,
    });

    expect(result.status).toBe('suspended');

    // Resume with same resourceId in context
    await run.resume({
      step: step1,
      resumeData: { approved: true },
      requestContext,
    });

    // Check resourceId is still persisted after resume
    const workflowRun = await testStorage.getWorkflowRunById({
      runId,
      workflowName: 'test-workflow',
    });

    expect(workflowRun?.resourceId).toBe(resourceId);
  });
});
