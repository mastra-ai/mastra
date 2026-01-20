/**
 * Type tests for @mastra/client-js Workflow resource
 * Tests workflow runs, start, resume, and related types
 */
import { expectTypeOf, describe, it } from 'vitest';
import { MastraClient } from '@mastra/client-js';
import type { WorkflowRunResult } from '@mastra/client-js';

// Create a client instance for testing
const client = new MastraClient({ baseUrl: 'http://localhost:3000' });

describe('Workflow start', () => {
  it('should accept input data', async () => {
    const workflow = client.getWorkflow('my-workflow');
    const result = workflow.start({
      inputData: { name: 'John', age: 30 },
    });

    expectTypeOf(result).toExtend<Promise<WorkflowRunResult>>();
  });

  it('should accept resourceId and runId', async () => {
    const workflow = client.getWorkflow('my-workflow');
    const result = workflow.start({
      inputData: { name: 'John' },
      resourceId: 'user-123',
      runId: 'run-456',
    });

    expectTypeOf(result).toExtend<Promise<WorkflowRunResult>>();
  });

  it('should accept requestContext', async () => {
    const workflow = client.getWorkflow('my-workflow');
    const result = workflow.start({
      inputData: { name: 'John' },
      requestContext: { userId: 'user-123' },
    });

    expectTypeOf(result).toExtend<Promise<WorkflowRunResult>>();
  });
});

describe('Workflow resume', () => {
  it('should accept runId and resumeData', async () => {
    const workflow = client.getWorkflow('my-workflow');
    const result = workflow.resume({
      runId: 'run-123',
      step: 'approval-step',
      resumeData: { approved: true },
    });

    expectTypeOf(result).toExtend<Promise<WorkflowRunResult>>();
  });

  it('should accept requestContext', async () => {
    const workflow = client.getWorkflow('my-workflow');
    const result = workflow.resume({
      runId: 'run-123',
      step: 'approval-step',
      resumeData: { approved: true },
      requestContext: { userId: 'user-123' },
    });

    expectTypeOf(result).toExtend<Promise<WorkflowRunResult>>();
  });
});
