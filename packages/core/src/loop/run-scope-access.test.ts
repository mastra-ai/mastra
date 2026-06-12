import { describe, expect, it } from 'vitest';
import { Mastra } from '../mastra';
import { createRunScopeKey } from '../mastra/run-scope';
import { getRunScope, readScoped, writeScoped, type RunScopeContext } from './run-scope-access';
import { THREAD_ID_KEY, RESOURCE_ID_KEY, STEP_TOOLS_KEY } from './run-scope-keys';
import type { StreamInternal } from './types';

function makeMastra() {
  return new Mastra({ logger: false });
}

describe('getRunScope', () => {
  it('returns undefined when no mastra is supplied', () => {
    expect(getRunScope({ runId: 'r' })).toBeUndefined();
  });

  it('returns undefined when no runId is supplied', () => {
    const mastra = makeMastra();
    expect(getRunScope({ mastra })).toBeUndefined();
  });

  it('returns undefined when the scope has not been created for the runId', () => {
    const mastra = makeMastra();
    expect(getRunScope({ mastra, runId: 'r' })).toBeUndefined();
  });

  it('returns the scope when both mastra and runId resolve a live scope', () => {
    const mastra = makeMastra();
    const scope = mastra.__createRunScope('r');
    expect(getRunScope({ mastra, runId: 'r' })).toBe(scope);
    mastra.__releaseRunScope('r');
  });
});

describe('readScoped', () => {
  it('returns undefined when neither scope nor _internal carry the value', () => {
    expect(readScoped({}, THREAD_ID_KEY, 'threadId')).toBeUndefined();
  });

  it('falls back to _internal when no scope exists (legacy test path)', () => {
    const ctx: RunScopeContext = { _internal: { threadId: 'legacy-thread' } };
    expect(readScoped(ctx, THREAD_ID_KEY, 'threadId')).toBe('legacy-thread');
  });

  it('prefers the scope over _internal when both are populated', () => {
    const mastra = makeMastra();
    const scope = mastra.__createRunScope('r');
    scope.set(THREAD_ID_KEY, 'scoped-thread');

    const ctx: RunScopeContext = {
      mastra,
      runId: 'r',
      _internal: { threadId: 'legacy-thread' },
    };
    expect(readScoped(ctx, THREAD_ID_KEY, 'threadId')).toBe('scoped-thread');
    mastra.__releaseRunScope('r');
  });

  it('falls back to _internal when the scope slot is unset (durable-resume / ToolSearchProcessor path)', () => {
    // Durable resume populates `_internal.stepTools` via `resolveInternalState`
    // but does NOT run `hydrateRunScopeFromInternal` (stepTools is in the skip
    // list). readScoped must surface the bootstrap value through the fallback.
    const mastra = makeMastra();
    mastra.__createRunScope('r');
    const stepTools = { mySearch: { description: 'x' } } as any;
    const ctx: RunScopeContext = {
      mastra,
      runId: 'r',
      _internal: { stepTools } as StreamInternal,
    };
    expect(readScoped(ctx, STEP_TOOLS_KEY, 'stepTools')).toBe(stepTools);
    mastra.__releaseRunScope('r');
  });

  it('preserves class-instance identity (no copy through the resolver)', () => {
    class Live {
      constructor(public n: number) {}
    }
    const KEY = createRunScopeKey<Live>('live');
    const mastra = makeMastra();
    const scope = mastra.__createRunScope('r');
    const inst = new Live(7);
    scope.set(KEY, inst);
    expect(readScoped({ mastra, runId: 'r' }, KEY, 'memory')).toBe(inst);
    mastra.__releaseRunScope('r');
  });

  it('treats a scope slot explicitly set to undefined as a miss and falls back', () => {
    // readScoped checks `v !== undefined` before returning the scope value, so
    // an explicit undefined falls through to _internal — this is the contract
    // the hydrate-skip behaviour relies on.
    const mastra = makeMastra();
    const scope = mastra.__createRunScope('r');
    scope.set(THREAD_ID_KEY, undefined as unknown as string);
    const ctx: RunScopeContext = {
      mastra,
      runId: 'r',
      _internal: { threadId: 'fallback' },
    };
    expect(readScoped(ctx, THREAD_ID_KEY, 'threadId')).toBe('fallback');
    mastra.__releaseRunScope('r');
  });
});

describe('writeScoped', () => {
  it('writes to the scope when one exists', () => {
    const mastra = makeMastra();
    const scope = mastra.__createRunScope('r');
    writeScoped({ mastra, runId: 'r' }, THREAD_ID_KEY, 'threadId', 'wrote');
    expect(scope.get(THREAD_ID_KEY)).toBe('wrote');
    mastra.__releaseRunScope('r');
  });

  it('mirrors the write to _internal so legacy callers observe the mutation', () => {
    const mastra = makeMastra();
    mastra.__createRunScope('r');
    const internal: StreamInternal = {};
    writeScoped({ mastra, runId: 'r', _internal: internal }, RESOURCE_ID_KEY, 'resourceId', 'r-mirror');
    expect(internal.resourceId).toBe('r-mirror');
    mastra.__releaseRunScope('r');
  });

  it('writes only to _internal when no scope exists (legacy test path)', () => {
    const internal: StreamInternal = {};
    writeScoped({ _internal: internal }, THREAD_ID_KEY, 'threadId', 'legacy-only');
    expect(internal.threadId).toBe('legacy-only');
  });

  it('is a no-op when neither scope nor _internal are provided (does not throw)', () => {
    expect(() => writeScoped({}, THREAD_ID_KEY, 'threadId', 'x')).not.toThrow();
  });

  it('round-trips a write through readScoped', () => {
    const mastra = makeMastra();
    mastra.__createRunScope('r');
    const ctx: RunScopeContext = { mastra, runId: 'r' };
    writeScoped(ctx, THREAD_ID_KEY, 'threadId', 'roundtrip');
    expect(readScoped(ctx, THREAD_ID_KEY, 'threadId')).toBe('roundtrip');
    mastra.__releaseRunScope('r');
  });
});
