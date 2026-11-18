import { describe, expect, it } from 'vitest';
import { getStepResult, getStepResultAsync } from './step';
import type { StepResult } from './types';

const stepResults: Record<string, StepResult<any, any, any, any>> = {
  done: { status: 'success', output: { value: 1 }, payload: {}, startedAt: 1, endedAt: 2 },
  broken: { status: 'failed', error: new Error('boom'), payload: {}, startedAt: 1, endedAt: 2 },
  paused: { status: 'suspended', payload: {}, suspendPayload: {}, startedAt: 1, suspendedAt: 2 },
  bypassed: { status: 'skipped' } as StepResult<any, any, any, any>,
};

describe('getStepResultAsync', () => {
  it.each([
    ['a successful step by id', 'done'],
    ['a successful step by reference', { id: 'done' }],
    ['a failed step', 'broken'],
    ['a suspended step', 'paused'],
    ['a skipped step', 'bypassed'],
    ['an unknown step', 'missing'],
    ['a reference without an id', {}],
  ])('resolves to the same value as getStepResult for %s', async (_, step) => {
    const result = getStepResultAsync(stepResults, step);

    expect(result).toBeInstanceOf(Promise);
    expect(await result).toEqual(getStepResult(stepResults, step));
  });

  it('resolves to the output of a successful step and null otherwise', async () => {
    expect(await getStepResultAsync(stepResults, 'done')).toEqual({ value: 1 });
    expect(await getStepResultAsync(stepResults, 'broken')).toBeNull();
    expect(await getStepResultAsync(stepResults, 'paused')).toBeNull();
    expect(await getStepResultAsync(stepResults, 'bypassed')).toBeNull();
    expect(await getStepResultAsync(stepResults, 'missing')).toBeNull();
  });
});
