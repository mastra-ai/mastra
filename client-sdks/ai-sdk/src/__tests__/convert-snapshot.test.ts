import type { WorkflowState } from '@mastra/core/workflows';
import { describe, expect, it } from 'vitest';

import { workflowSnapshotToStream } from '../convert-snapshot';

function createWorkflowRun(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    runId: 'run-1',
    workflowName: 'test-workflow',
    status: 'success',
    createdAt: new Date(),
    updatedAt: new Date(),
    steps: {
      'step-a': {
        status: 'success',
        output: { answer: 42 },
        payload: { query: 'hello' },
        startedAt: 1000,
        endedAt: 2000,
      },
      'step-b': {
        status: 'success',
        output: 'done',
        payload: { value: 1 },
        startedAt: 2000,
        endedAt: 3000,
      },
    },
    ...overrides,
  };
}

async function collectStream(stream: ReadableStream): Promise<any[]> {
  const chunks: any[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

describe('workflowSnapshotToStream', () => {
  it('produces start, workflow data, step data, and finish chunks', async () => {
    const run = createWorkflowRun();
    const stream = workflowSnapshotToStream(run);
    const chunks = await collectStream(stream);

    expect(chunks[0]).toEqual({ type: 'start' });
    expect(chunks[chunks.length - 1]).toEqual({ type: 'finish' });

    const workflowPart = chunks.find(c => c.type === 'data-workflow');
    expect(workflowPart).toBeDefined();
    expect(workflowPart.id).toBe('run-1');
    expect(workflowPart.data.name).toBe('test-workflow');
    expect(workflowPart.data.status).toBe('success');
    expect(Object.keys(workflowPart.data.steps)).toEqual(['step-a', 'step-b']);

    const stepParts = chunks.filter(c => c.type === 'data-workflow-step');
    expect(stepParts).toHaveLength(2);
    expect(stepParts[0].data.stepId).toBe('step-a');
    expect(stepParts[0].data.step.output).toEqual({ answer: 42 });
    expect(stepParts[1].data.stepId).toBe('step-b');
    expect(stepParts[1].data.step.output).toBe('done');
  });

  it('handles suspended workflow runs', async () => {
    const run = createWorkflowRun({
      status: 'suspended',
      steps: {
        'step-1': {
          status: 'suspended',
          payload: { x: 1 },
          suspendPayload: { reason: 'need approval' },
          startedAt: 1000,
          suspendedAt: 2000,
        },
      },
    });

    const stream = workflowSnapshotToStream(run);
    const chunks = await collectStream(stream);

    const workflowPart = chunks.find(c => c.type === 'data-workflow');
    expect(workflowPart.data.status).toBe('suspended');

    const stepPart = chunks.find(c => c.type === 'data-workflow-step');
    expect(stepPart.data.step.status).toBe('suspended');
    expect(stepPart.data.step.suspendPayload).toEqual({ reason: 'need approval' });
  });

  it('handles empty steps', async () => {
    const run = createWorkflowRun({ steps: {} });
    const stream = workflowSnapshotToStream(run);
    const chunks = await collectStream(stream);

    expect(chunks).toHaveLength(3); // start, workflow-data, finish
    expect(chunks.filter(c => c.type === 'data-workflow-step')).toHaveLength(0);
  });

  it('handles undefined steps', async () => {
    const run = createWorkflowRun({ steps: undefined });
    const stream = workflowSnapshotToStream(run);
    const chunks = await collectStream(stream);

    expect(chunks).toHaveLength(3); // start, workflow-data, finish
  });

  it('preserves forEach array step outputs and suspended status', async () => {
    const run = createWorkflowRun({
      steps: {
        'forEach-step': [
          { status: 'success', output: 'first', payload: { i: 0 }, startedAt: 1000, endedAt: 2000 },
          {
            status: 'suspended',
            payload: { i: 1 },
            suspendPayload: { reason: 'review second' },
            startedAt: 2000,
            suspendedAt: 3000,
          },
        ],
      },
    });

    const stream = workflowSnapshotToStream(run);
    const chunks = await collectStream(stream);

    const stepPart = chunks.find(c => c.type === 'data-workflow-step');
    expect(stepPart.data.stepId).toBe('forEach-step');
    expect(stepPart.data.step.status).toBe('suspended');
    expect(stepPart.data.step.input).toEqual([{ i: 0 }, { i: 1 }]);
    expect(stepPart.data.step.output).toEqual(['first', undefined]);
    expect(stepPart.data.step.suspendPayload).toEqual({ reason: 'review second' });
  });
});
