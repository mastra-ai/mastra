/**
 * Tests for workflows/utils.ts
 *
 * Covers the pure utility functions that do not require a running workflow engine:
 *   - cleanStepResult          – strips internal __state / metadata.nestedRunId fields
 *   - hydrateSerializedStepErrors – re-hydrates serialised error objects
 *   - getStepIds               – extracts step IDs from a StepFlowEntry
 *   - getResumeLabelsByStepId  – filters resume labels by step
 *   - createDeprecationProxy   – warns once when a deprecated property is accessed
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanStepResult,
  createDeprecationProxy,
  getResumeLabelsByStepId,
  getStepIds,
  hydrateSerializedStepErrors,
} from './utils';

// ---------------------------------------------------------------------------
// cleanStepResult
// ---------------------------------------------------------------------------

describe('cleanStepResult', () => {
  it('returns null unchanged', () => {
    expect(cleanStepResult(null)).toBeNull();
  });

  it('returns undefined unchanged', () => {
    expect(cleanStepResult(undefined)).toBeUndefined();
  });

  it('returns a primitive unchanged', () => {
    expect(cleanStepResult(42)).toBe(42);
    expect(cleanStepResult('hello')).toBe('hello');
    expect(cleanStepResult(true)).toBe(true);
  });

  it('removes the __state key from a step result', () => {
    const result = { status: 'success', output: { value: 1 }, __state: { machine: 'x' } };
    const cleaned = cleanStepResult(result) as any;
    expect(cleaned).not.toHaveProperty('__state');
    expect(cleaned.status).toBe('success');
    expect(cleaned.output).toEqual({ value: 1 });
  });

  it('removes nestedRunId from metadata but preserves other metadata fields', () => {
    const result = {
      status: 'success',
      output: {},
      metadata: { nestedRunId: 'run-123', customField: 'keep-me' },
    };
    const cleaned = cleanStepResult(result) as any;
    expect(cleaned.metadata).toEqual({ customField: 'keep-me' });
    expect(cleaned.metadata).not.toHaveProperty('nestedRunId');
  });

  it('removes metadata entirely when nestedRunId is the only key', () => {
    const result = {
      status: 'success',
      output: {},
      metadata: { nestedRunId: 'run-abc' },
    };
    const cleaned = cleanStepResult(result) as any;
    expect(cleaned).not.toHaveProperty('metadata');
  });

  it('preserves metadata when it contains no nestedRunId', () => {
    const result = {
      status: 'success',
      output: {},
      metadata: { tag: 'v1' },
    };
    const cleaned = cleanStepResult(result) as any;
    expect(cleaned.metadata).toEqual({ tag: 'v1' });
  });

  it('does not mutate the original object', () => {
    const original = { status: 'success', __state: { x: 1 }, output: {} };
    cleanStepResult(original);
    expect(original).toHaveProperty('__state');
  });

  it('cleans __state from each item in a forEach array', () => {
    const items = [
      { output: 'a', __state: {} },
      { output: 'b', __state: {} },
    ];
    const cleaned = cleanStepResult(items) as any[];
    expect(cleaned[0]).not.toHaveProperty('__state');
    expect(cleaned[1]).not.toHaveProperty('__state');
    expect(cleaned[0].output).toBe('a');
  });

  it('cleans __state inside the output array (forEach nested results)', () => {
    const result = {
      status: 'success',
      output: [
        { value: 1, __state: {} },
        { value: 2, __state: {} },
      ],
    };
    const cleaned = cleanStepResult(result) as any;
    expect(cleaned.output[0]).not.toHaveProperty('__state');
    expect(cleaned.output[1]).not.toHaveProperty('__state');
    expect(cleaned.output[0].value).toBe(1);
  });

  it('leaves non-object items in the output array unchanged', () => {
    const result = { status: 'success', output: [1, 'two', null] };
    const cleaned = cleanStepResult(result) as any;
    expect(cleaned.output).toEqual([1, 'two', null]);
  });

  it('passes through a result with no internal properties unchanged', () => {
    const result = { status: 'success', output: { answer: 42 } };
    expect(cleanStepResult(result)).toEqual(result);
  });
});

// ---------------------------------------------------------------------------
// hydrateSerializedStepErrors
// ---------------------------------------------------------------------------

describe('hydrateSerializedStepErrors', () => {
  it('converts a serialised error object into an Error instance', () => {
    const context = {
      step1: {
        status: 'failed' as const,
        error: { message: 'something broke', name: 'Error' },
      },
    } as any;

    const result = hydrateSerializedStepErrors(context);
    expect(result!.step1.error).toBeInstanceOf(Error);
    expect((result!.step1.error as Error).message).toBe('something broke');
  });

  it('preserves successful steps unchanged', () => {
    const context = {
      step1: { status: 'success' as const, output: { value: 1 } },
    } as any;

    const result = hydrateSerializedStepErrors(context);
    expect(result!.step1).toEqual({ status: 'success', output: { value: 1 } });
  });

  it('skips failed steps that have no error field', () => {
    const context = {
      step1: { status: 'failed' as const },
    } as any;
    expect(() => hydrateSerializedStepErrors(context)).not.toThrow();
  });

  it('handles multiple steps, only hydrating failed ones', () => {
    const context = {
      ok: { status: 'success' as const, output: {} },
      bad: { status: 'failed' as const, error: { message: 'oops', name: 'Error' } },
    } as any;

    const result = hydrateSerializedStepErrors(context);
    expect(result!.bad.error).toBeInstanceOf(Error);
    expect(result!.ok.output).toEqual({});
  });

  it('returns undefined unchanged', () => {
    expect(hydrateSerializedStepErrors(undefined)).toBeUndefined();
  });

  it('mutates and returns the same context object reference', () => {
    const context = {
      step1: { status: 'failed' as const, error: { message: 'err', name: 'Error' } },
    } as any;
    const result = hydrateSerializedStepErrors(context);
    expect(result).toBe(context);
  });
});

// ---------------------------------------------------------------------------
// getStepIds
// ---------------------------------------------------------------------------

describe('getStepIds', () => {
  const makeStep = (id: string) => ({ id }) as any;

  it('returns the step id for a "step" entry', () => {
    expect(getStepIds({ type: 'step', step: makeStep('my-step') } as any)).toEqual(['my-step']);
  });

  it('returns the step id for a "foreach" entry', () => {
    expect(getStepIds({ type: 'foreach', step: makeStep('each-step') } as any)).toEqual(['each-step']);
  });

  it('returns the step id for a "loop" entry', () => {
    expect(getStepIds({ type: 'loop', step: makeStep('loop-step') } as any)).toEqual(['loop-step']);
  });

  it('returns all step ids for a "parallel" entry', () => {
    const entry = {
      type: 'parallel',
      steps: [
        { type: 'step', step: makeStep('a') },
        { type: 'step', step: makeStep('b') },
      ],
    } as any;
    expect(getStepIds(entry)).toEqual(['a', 'b']);
  });

  it('returns all step ids for a "conditional" entry', () => {
    const entry = {
      type: 'conditional',
      steps: [
        { type: 'step', step: makeStep('x') },
        { type: 'step', step: makeStep('y') },
        { type: 'step', step: makeStep('z') },
      ],
    } as any;
    expect(getStepIds(entry)).toEqual(['x', 'y', 'z']);
  });

  it('returns the id for a "sleep" entry', () => {
    expect(getStepIds({ type: 'sleep', id: 'wait-30s' } as any)).toEqual(['wait-30s']);
  });

  it('returns the id for a "sleepUntil" entry', () => {
    expect(getStepIds({ type: 'sleepUntil', id: 'wait-until-monday' } as any)).toEqual(['wait-until-monday']);
  });

  it('returns an empty array for an unknown entry type', () => {
    expect(getStepIds({ type: 'unknown' } as any)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getResumeLabelsByStepId
// ---------------------------------------------------------------------------

describe('getResumeLabelsByStepId', () => {
  const labels = {
    label_a: { stepId: 'step-1' },
    label_b: { stepId: 'step-2' },
    label_c: { stepId: 'step-1', foreachIndex: 2 },
  };

  it('returns only labels matching the given stepId', () => {
    const result = getResumeLabelsByStepId(labels, 'step-1');
    expect(result).toEqual({
      label_a: { stepId: 'step-1' },
      label_c: { stepId: 'step-1', foreachIndex: 2 },
    });
  });

  it('returns an empty object when no labels match', () => {
    expect(getResumeLabelsByStepId(labels, 'step-99')).toEqual({});
  });

  it('returns all labels when they all share the same stepId', () => {
    const allSame = {
      x: { stepId: 'step-A' },
      y: { stepId: 'step-A' },
    };
    expect(getResumeLabelsByStepId(allSame, 'step-A')).toEqual(allSame);
  });

  it('returns an empty object for an empty labels map', () => {
    expect(getResumeLabelsByStepId({}, 'step-1')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// createDeprecationProxy
// ---------------------------------------------------------------------------

describe('createDeprecationProxy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Each test uses a unique paramName to avoid cross-test pollution from the
  // module-level shownWarnings Set that tracks which params have been warned.

  it('logs a warning the first time a deprecated property is accessed', () => {
    const logger = { warn: vi.fn() } as any;
    const proxy = createDeprecationProxy({ runCount_t1: 3, retryCount: 3 } as any, {
      paramName: 'runCount_t1',
      deprecationMessage: 'use retryCount',
      logger,
    });

    const _ = (proxy as any).runCount_t1;
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), 'use retryCount');
  });

  it('only logs the warning once across multiple accesses', () => {
    const logger = { warn: vi.fn() } as any;
    const proxy = createDeprecationProxy({ runCount_t2: 1, retryCount: 1 } as any, {
      paramName: 'runCount_t2',
      deprecationMessage: 'use retryCount',
      logger,
    });

    const _a = (proxy as any).runCount_t2;
    const _b = (proxy as any).runCount_t2;
    const _c = (proxy as any).runCount_t2;
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('does not log when a non-deprecated property is accessed', () => {
    const logger = { warn: vi.fn() } as any;
    const proxy = createDeprecationProxy({ runCount_t3: 2, retryCount: 2 } as any, {
      paramName: 'runCount_t3',
      deprecationMessage: 'use retryCount',
      logger,
    });

    const _ = proxy.retryCount;
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('still returns the correct value for the deprecated property', () => {
    const logger = { warn: vi.fn() } as any;
    const proxy = createDeprecationProxy({ runCount_t4: 7, retryCount: 7 } as any, {
      paramName: 'runCount_t4',
      deprecationMessage: 'use retryCount',
      logger,
    });

    expect((proxy as any).runCount_t4).toBe(7);
  });

  it('returns the correct value for non-deprecated properties', () => {
    const logger = { warn: vi.fn() } as any;
    const proxy = createDeprecationProxy({ runCount_t5: 1, retryCount: 5 } as any, {
      paramName: 'runCount_t5',
      deprecationMessage: 'use retryCount',
      logger,
    });

    expect(proxy.retryCount).toBe(5);
  });
});
