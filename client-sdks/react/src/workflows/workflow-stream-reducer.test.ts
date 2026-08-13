import { describe, expect, it } from 'vitest';
import { mapWorkflowStreamChunkToWatchResult } from './workflow-stream-reducer';

const reduce = (previous: any, type: string, payload: Record<string, unknown> = {}) =>
  mapWorkflowStreamChunkToWatchResult(previous, {
    type,
    payload,
    runId: 'run-1',
    from: 'WORKFLOW',
  });

describe('mapWorkflowStreamChunkToWatchResult', () => {
  it('projects native lifecycle chunks into a successful run result', () => {
    const running = reduce({ input: { image: 'image.png' }, steps: {} }, 'workflow-start');
    const stepStarted = reduce(running, 'workflow-step-start', { id: 'generate', status: 'running' });
    const stepFinished = reduce(stepStarted, 'workflow-step-result', {
      id: 'generate',
      status: 'success',
      output: { images: ['one.png', 'two.png'] },
    });
    const finished = reduce(stepFinished, 'workflow-finish', { workflowStatus: 'success' });

    expect(finished).toMatchObject({
      status: 'success',
      result: { images: ['one.png', 'two.png'] },
      steps: { generate: { status: 'success' } },
    });
  });

  it('preserves nested suspended paths from native chunks', () => {
    const suspended = reduce({ status: 'running', steps: {} }, 'workflow-step-suspended', {
      id: 'approval',
      status: 'suspended',
      suspendPayload: {
        reason: 'approval',
        __workflow_meta: { path: ['nested', 'approval'] },
      },
    });

    expect(suspended).toMatchObject({
      status: 'suspended',
      suspended: [['approval', 'nested', 'approval']],
      suspendPayload: { reason: 'approval' },
    });
  });

  it.each([
    ['workflow-canceled', 'canceled'],
    ['workflow-step-waiting', 'waiting'],
  ])('maps %s to %s', (type, status) => {
    expect(reduce({ status: 'running', steps: {} }, type, { id: 'step-1' })).toMatchObject({ status });
  });
});
