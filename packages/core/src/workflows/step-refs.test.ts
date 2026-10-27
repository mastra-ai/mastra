import { describe, expect, it, vi } from 'vitest';
import type { Predicate } from './predicate';
import { collectMappingStepRefs, collectPredicateStepRefs, resolveStepOutputs, stepRefId } from './step-refs';
import { predicateToCondition } from './workflow';

describe('collectMappingStepRefs', () => {
  it('collects step sources, array arms and template placeholders without duplicates', () => {
    const refs = collectMappingStepRefs({
      single: { step: { id: 'a' }, path: 'x' },
      byId: { step: 'b', path: '.' },
      arms: { step: [{ id: 'a' }, { id: 'c' }], path: 'y' },
      template: { template: 'hi ${stepResults.d.name} ${stepResults.a} ${inputData.q} ${state.s}' },
    });
    expect(refs.sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignores value, fn, requestContextPath and initData sources', () => {
    expect(
      collectMappingStepRefs({
        value: { value: 1, step: { id: 'no-1' } },
        fn: { fn: () => 1, step: { id: 'no-2' } },
        request: { requestContextPath: 'k', step: { id: 'no-3' } },
        init: { initData: true, path: 'x', step: { id: 'no-4' } },
      }),
    ).toEqual([]);
  });

  it('skips step sources without an id', () => {
    expect(collectMappingStepRefs({ broken: { step: {}, path: '.' }, nothing: { path: '.' } })).toEqual([]);
  });

  it('caches the result per config object', () => {
    const config = { a: { step: { id: 'a' }, path: '.' } };
    const first = collectMappingStepRefs(config);
    expect(collectMappingStepRefs(config)).toBe(first);
    expect(collectMappingStepRefs({ ...config })).not.toBe(first);
  });
});

describe('collectPredicateStepRefs', () => {
  it('collects stepResults ids from every predicate form', () => {
    const predicate: Predicate = {
      op: 'and',
      args: [
        { op: 'eq', left: { path: 'stepResults.a.status' }, right: { path: '${stepResults.b}' } },
        { op: 'in', value: { path: 'stepResults.c.kind' }, set: ['x'] },
        { op: 'not', arg: { op: 'exists', path: 'stepResults.d' } },
        { op: 'or', args: [{ op: 'truthy', value: { path: 'stepResults.a.ok' } }] },
        { op: 'gt', left: { path: 'inputData.n' }, right: { literal: 1 } },
        { op: 'notExists', path: 'stepResults' },
      ],
    };
    expect(collectPredicateStepRefs(predicate).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('stepRefId', () => {
  it('reads ids from strings and step-like objects', () => {
    expect(stepRefId('a')).toBe('a');
    expect(stepRefId({ id: 'b' })).toBe('b');
    expect(stepRefId({})).toBeUndefined();
    expect(stepRefId(undefined)).toBeUndefined();
  });
});

describe('resolveStepOutputs', () => {
  it('resolves ids into a map, keeping null and undefined outputs', async () => {
    const outputs = await resolveStepOutputs(['a', 'b', 'c'], async id =>
      id === 'a' ? { x: 1 } : id === 'b' ? null : undefined,
    );
    expect([...outputs]).toEqual([
      ['a', { x: 1 }],
      ['b', null],
      ['c', undefined],
    ]);
  });
});

describe('predicateToCondition', () => {
  const throwingSync = () => {
    throw new Error('sync getStepResult is not available');
  };

  it('evaluates step references from getStepResultAsync, never the sync accessor', async () => {
    const getStepResultAsync = vi.fn(async (id: string) => (id === 'check' ? { ok: true } : null));
    const condition = predicateToCondition({
      op: 'and',
      args: [
        { op: 'eq', left: { path: 'stepResults.check.ok' }, right: { literal: true } },
        { op: 'notExists', path: 'stepResults.skipped' },
      ],
    });

    await expect(condition({ getStepResult: throwingSync, getStepResultAsync })).resolves.toBe(true);
    expect(getStepResultAsync.mock.calls.map(([id]) => id).sort()).toEqual(['check', 'skipped']);
  });

  it('treats null, undefined and unresolvable step outputs as missing', async () => {
    const condition = predicateToCondition({ op: 'exists', path: 'stepResults.a' });
    await expect(condition({ getStepResultAsync: async () => null })).resolves.toBe(false);
    await expect(condition({ getStepResultAsync: async () => undefined })).resolves.toBe(false);
    await expect(condition({})).resolves.toBe(false);
    await expect(condition({ getStepResultAsync: async () => 0 })).resolves.toBe(true);
  });

  it('still reads inputData, initData and state', async () => {
    const condition = predicateToCondition({
      op: 'and',
      args: [
        { op: 'eq', left: { path: 'inputData.n' }, right: { literal: 1 } },
        { op: 'eq', left: { path: 'initData.city' }, right: { literal: 'Berlin' } },
        { op: 'eq', left: { path: 'state.phase' }, right: { literal: 'draft' } },
      ],
    });
    await expect(
      condition({
        inputData: { n: 1 },
        getInitData: () => ({ city: 'Berlin' }),
        state: { phase: 'draft' },
        getStepResult: throwingSync,
        getStepResultAsync: async () => null,
      }),
    ).resolves.toBe(true);
  });
});
