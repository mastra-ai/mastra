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
    const finished = reduce(stepFinished, 'workflow-finish', {
      workflowStatus: 'success',
      finalWorkflowResult: { images: ['one.png', 'two.png'] },
    });

    expect(finished).toMatchObject({
      status: 'success',
      result: { images: ['one.png', 'two.png'] },
      steps: { generate: { status: 'success' } },
    });
  });

  it.each([
    ['is still running', undefined],
    ['completes later', { id: 'step-b', status: 'success', output: { value: 'done' } }],
  ])('preserves the failing parallel step error when a later step %s', (_scenario, laterStepResult) => {
    const error = new Error('step A failed');
    const stepAStarted = reduce({ status: 'running', steps: {} }, 'workflow-step-start', {
      id: 'step-a',
      status: 'running',
    });
    const stepBStarted = reduce(stepAStarted, 'workflow-step-start', { id: 'step-b', status: 'running' });
    const stepAFailed = reduce(stepBStarted, 'workflow-step-result', {
      id: 'step-a',
      status: 'failed',
      error,
    });
    const beforeFinish = laterStepResult ? reduce(stepAFailed, 'workflow-step-result', laterStepResult) : stepAFailed;
    const finished = reduce(beforeFinish, 'workflow-finish', { workflowStatus: 'failed', metadata: {} });

    expect(finished).toMatchObject({
      status: 'failed',
      error,
      steps: {
        'step-a': { status: 'failed', error },
        'step-b': { status: laterStepResult ? 'success' : 'running' },
      },
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
