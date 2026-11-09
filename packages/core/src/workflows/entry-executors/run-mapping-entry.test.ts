import { describe, expect, it, vi } from 'vitest';
import type { MappingStepEntry } from '../types';
import { runMappingEntry } from './run-mapping-entry';
import type { EntryExecuteContext } from './types';

const falsyOutputs: Array<{
  name: string;
  output: Record<string, never> | 0 | false | '';
}> = [
  { name: 'an empty object', output: {} },
  { name: 'zero', output: 0 },
  { name: 'false', output: false },
  { name: 'an empty string', output: '' },
];

function mappingEntry(mapConfig: MappingStepEntry['mapConfig']): MappingStepEntry {
  return { type: 'mapping', id: 'mapping-step', mapConfig } as MappingStepEntry;
}

/** Context whose sync accessor throws, like a run whose results aren't all in memory. */
function makeCtx(outputs: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  const getStepResultAsync = vi.fn(async (id: string) => (id in outputs ? outputs[id] : null));
  const ctx = {
    getStepResult: () => {
      throw new Error('sync getStepResult is not available');
    },
    getStepResultAsync,
    getInitData: vi.fn(() => ({ city: 'Berlin' })),
    requestContext: { get: vi.fn((key: string) => `rc:${key}`) },
    inputData: { name: 'in' },
    state: {},
    ...overrides,
  } as unknown as EntryExecuteContext;
  return { ctx, getStepResultAsync };
}

describe('runMappingEntry', () => {
  it.each(falsyOutputs)('preserves $name from the successful step in an array', async ({ output }) => {
    const skippedStep = { id: 'skipped-step' };
    const successfulStep = { id: 'successful-step' };
    const { ctx } = makeCtx({ 'successful-step': output });

    const entry = mappingEntry({ picked: { step: [skippedStep, successfulStep], path: '.' } });

    await expect(runMappingEntry(entry, ctx)).resolves.toEqual({ picked: output });
  });

  it('resolves every referenced step once, before evaluating any key', async () => {
    const { ctx, getStepResultAsync } = makeCtx({ a: { x: 1 }, b: { y: 2 }, c: 'three' });
    const entry = mappingEntry({
      fromA: { step: { id: 'a' }, path: 'x' },
      fromAAgain: { step: 'a', path: '.' },
      fromArm: { step: [{ id: 'missing' }, { id: 'b' }], path: 'y' },
      fromTemplate: { template: '${stepResults.c}/${stepResults.a.x}' },
      fromValue: { value: 'v' },
      fromInit: { initData: true, path: 'city' },
      fromRequest: { requestContextPath: 'user' },
    });

    await expect(runMappingEntry(entry, ctx)).resolves.toEqual({
      fromA: 1,
      fromAAgain: { x: 1 },
      fromArm: 2,
      fromTemplate: 'three/1',
      fromValue: 'v',
      fromInit: 'Berlin',
      fromRequest: 'rc:user',
    });
    expect(getStepResultAsync.mock.calls.map(([id]) => id).sort()).toEqual(['a', 'b', 'c', 'missing']);
  });

  it('keeps the existing error when a referenced step has no output', async () => {
    const { ctx } = makeCtx({});
    await expect(runMappingEntry(mappingEntry({ out: { step: { id: 'gone' }, path: 'field' } }), ctx)).rejects.toThrow(
      'Invalid path field in step gone',
    );
    await expect(runMappingEntry(mappingEntry({ out: { template: '${stepResults.gone}' } }), ctx)).rejects.toThrow(
      /has no successful output/,
    );
  });

  it('returns null for a whole-output read of a step that did not succeed', async () => {
    const { ctx } = makeCtx({});
    await expect(runMappingEntry(mappingEntry({ out: { step: 'gone', path: '.' } }), ctx)).resolves.toEqual({
      out: null,
    });
  });

  it('keeps an undefined output from a successful step distinct from a missing one', async () => {
    const { ctx } = makeCtx({ done: undefined });
    await expect(
      runMappingEntry(mappingEntry({ out: { step: [{ id: 'done' }, { id: 'other' }], path: '.' } }), ctx),
    ).resolves.toEqual({ out: undefined });
  });

  it('passes the full context to fn entries and function configs', async () => {
    const { ctx, getStepResultAsync } = makeCtx({ a: 5 });

    const fn = vi.fn(async (c: any) => (await c.getStepResultAsync('a')) * 2);
    await expect(runMappingEntry(mappingEntry({ doubled: { fn } }), ctx)).resolves.toEqual({ doubled: 10 });
    expect(fn).toHaveBeenCalledWith(ctx);

    const mapFn = vi.fn(async (c: any) => ({ a: await c.getStepResultAsync('a') }));
    await expect(runMappingEntry(mappingEntry(mapFn as any), ctx)).resolves.toEqual({ a: 5 });
    expect(mapFn).toHaveBeenCalledWith(ctx);
    expect(getStepResultAsync).toHaveBeenCalledTimes(2);
  });
});
