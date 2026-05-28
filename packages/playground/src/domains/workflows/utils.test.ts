import type { WorkflowRunState } from '@mastra/core/workflows';
import { describe, expect, it, vi } from 'vitest';
import { convertWorkflowRunStateToStreamResult } from './utils';

describe('convertWorkflowRunStateToStreamResult', () => {
  it('returns an empty result when runState is null or undefined', () => {
    expect(convertWorkflowRunStateToStreamResult(null)).toEqual({ steps: {} });
    expect(convertWorkflowRunStateToStreamResult(undefined)).toEqual({ steps: {} });
  });

  it('skips context entries whose value is null or undefined', () => {
    const runState = {
      context: {
        input: { foo: 'bar' },
        step1: null,
        step2: undefined,
        step3: { status: 'success', payload: {}, output: 'done', startedAt: 1, endedAt: 2 },
      },
      status: 'running',
    } as unknown as WorkflowRunState;

    const result = convertWorkflowRunStateToStreamResult(runState);

    expect(result.steps).toEqual({
      step3: expect.objectContaining({ status: 'success', output: 'done' }),
    });
    expect(result.input).toEqual({ foo: 'bar' });
    expect(result.status).toBe('running');
  });

  it('skips context entries that are primitives or arrays', () => {
    const runState = {
      context: {
        input: { foo: 'bar' },
        primitiveStep: 'not-an-object',
        arrayStep: [{ status: 'success' }],
        validStep: { status: 'running', payload: {}, startedAt: 1 },
      },
      status: 'running',
    } as unknown as WorkflowRunState;

    const result = convertWorkflowRunStateToStreamResult(runState);

    expect(Object.keys(result.steps)).toEqual(['validStep']);
  });

  it('skips entries lacking a status field', () => {
    const runState = {
      context: {
        input: {},
        bogus: { foo: 'bar' },
      },
      status: 'running',
    } as unknown as WorkflowRunState;

    const result = convertWorkflowRunStateToStreamResult(runState);

    expect(result.steps).toEqual({});
  });

  it('does not throw if context itself is missing', () => {
    const runState = { status: 'running' } as unknown as WorkflowRunState;
    expect(() => convertWorkflowRunStateToStreamResult(runState)).not.toThrow();
  });

  it('preserves valid step conversion behaviour for a typical running snapshot', () => {
    const runState = {
      context: {
        input: { x: 1 },
        stepA: {
          status: 'success',
          payload: { in: 1 },
          output: { out: 2 },
          startedAt: 100,
          endedAt: 200,
        },
        stepB: { status: 'running', payload: { in: 2 }, startedAt: 150 },
      },
      status: 'running',
    } as unknown as WorkflowRunState;

    const result = convertWorkflowRunStateToStreamResult(runState);

    expect(result.steps.stepA).toMatchObject({ status: 'success', output: { out: 2 } });
    expect(result.steps.stepB).toMatchObject({ status: 'running', endedAt: undefined });
  });

  it('falls back to a minimal safe result and logs when conversion throws', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const runState = { status: 'running' } as unknown as WorkflowRunState;
    const malformedContext = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('boom');
        },
      },
    );
    (runState as any).context = malformedContext;

    const result = convertWorkflowRunStateToStreamResult(runState);

    expect(result).toEqual({ steps: {}, status: 'running' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[convertWorkflowRunStateToStreamResult] failed to convert snapshot',
      expect.objectContaining({ error: expect.any(Error) }),
    );

    consoleErrorSpy.mockRestore();
  });
});
