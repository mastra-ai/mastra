/**
 * Tests for packages/core/src/agent/state-signals.ts
 *
 * All synchronous exported functions are pure — no I/O, no async,
 * no mocking required. Tests exercise real branching logic: metadata
 * extraction, immutability, sort-stability, history derivation, and
 * signal deduplication.
 */
import { describe, expect, it } from 'vitest';

import {
  createStateSignalInput,
  deriveStateSignalHistory,
  getStateSignalsMetadata,
  mergeStateSignals,
  setStateSignalMetadata,
  sortStateSignals,
} from './state-signals';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStateSignal(overrides: Record<string, any> = {}): any {
  const { createSignal } = require('./signals');
  const base = createSignal({
    type: 'state',
    tagName: 'state',
    contents: '{}',
    metadata: {
      state: {
        id: 'state-1',
        threadId: 'thread-1',
        mode: 'snapshot',
        version: 1,
        cacheKey: 'ck-1',
      },
    },
    ...overrides,
  });
  return { ...base, type: 'state', createdAt: overrides.createdAt ?? new Date() };
}

// ---------------------------------------------------------------------------
// getStateSignalsMetadata
// ---------------------------------------------------------------------------

describe('getStateSignalsMetadata', () => {
  it('returns empty object for undefined threadMetadata', () => {
    expect(getStateSignalsMetadata(undefined)).toEqual({});
  });

  it('returns empty object when mastra key is missing', () => {
    expect(getStateSignalsMetadata({ other: 'data' })).toEqual({});
  });

  it('returns empty object when mastra is not a plain object', () => {
    expect(getStateSignalsMetadata({ mastra: 'string' })).toEqual({});
    expect(getStateSignalsMetadata({ mastra: 42 })).toEqual({});
    expect(getStateSignalsMetadata({ mastra: null })).toEqual({});
  });

  it('returns empty object when stateSignals is not a plain object', () => {
    expect(getStateSignalsMetadata({ mastra: { stateSignals: 'bad' } })).toEqual({});
  });

  it('returns stateSignals when present and valid', () => {
    const tracking = { version: 1, currentMode: 'snapshot' as const };
    const result = getStateSignalsMetadata({
      mastra: { stateSignals: { 'state-1': tracking } },
    });
    expect(result).toEqual({ 'state-1': tracking });
  });

  it('returns all stateSignals entries', () => {
    const result = getStateSignalsMetadata({
      mastra: {
        stateSignals: {
          'state-1': { version: 1 },
          'state-2': { version: 2 },
        },
      },
    });
    expect(Object.keys(result)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// setStateSignalMetadata
// ---------------------------------------------------------------------------

describe('setStateSignalMetadata', () => {
  it('creates mastra.stateSignals structure from scratch when metadata is undefined', () => {
    const result = setStateSignalMetadata(undefined, 'state-1', { version: 1 });
    expect(result.mastra).toBeDefined();
    const mastra = result.mastra as any;
    expect(mastra.stateSignals['state-1'].version).toBe(1);
  });

  it('creates stateSignals inside existing mastra object', () => {
    const result = setStateSignalMetadata({ mastra: { existingKey: 'value' } }, 'state-1', { version: 2 });
    const mastra = result.mastra as any;
    expect(mastra.existingKey).toBe('value');
    expect(mastra.stateSignals['state-1'].version).toBe(2);
  });

  it('adds a new stateId alongside existing ones', () => {
    const existing = setStateSignalMetadata(undefined, 'state-1', { version: 1 });
    const updated = setStateSignalMetadata(existing, 'state-2', { version: 2 });
    const mastra = updated.mastra as any;
    expect(mastra.stateSignals['state-1'].version).toBe(1);
    expect(mastra.stateSignals['state-2'].version).toBe(2);
  });

  it('overwrites existing tracking for the same stateId', () => {
    const first = setStateSignalMetadata(undefined, 'state-1', { version: 1 });
    const updated = setStateSignalMetadata(first, 'state-1', { version: 99 });
    const mastra = updated.mastra as any;
    expect(mastra.stateSignals['state-1'].version).toBe(99);
  });

  it('does not mutate the original threadMetadata object', () => {
    const original = { mastra: { stateSignals: { 'state-1': { version: 1 } } } };
    setStateSignalMetadata(original, 'state-1', { version: 999 });
    const mastra = original.mastra as any;
    expect(mastra.stateSignals['state-1'].version).toBe(1);
  });

  it('preserves other keys in threadMetadata', () => {
    const result = setStateSignalMetadata({ customKey: 'keep-me' }, 'state-1', {});
    expect(result.customKey).toBe('keep-me');
  });
});

// ---------------------------------------------------------------------------
// sortStateSignals
// ---------------------------------------------------------------------------

describe('sortStateSignals', () => {
  it('returns empty array for empty input', () => {
    expect(sortStateSignals([])).toEqual([]);
  });

  it('returns single signal unchanged', () => {
    const signal = makeStateSignal();
    expect(sortStateSignals([signal])).toHaveLength(1);
  });

  it('sorts signals by createdAt ascending', () => {
    const older = makeStateSignal({ createdAt: new Date('2024-01-01T00:00:00Z') });
    const newer = makeStateSignal({ createdAt: new Date('2024-01-02T00:00:00Z') });
    const [first, second] = sortStateSignals([newer, older]);
    expect(first.createdAt.getTime()).toBeLessThan(second.createdAt.getTime());
  });

  it('uses insertion order as tiebreaker for equal timestamps', () => {
    const ts = new Date('2024-01-01T00:00:00Z');
    const a = makeStateSignal({ createdAt: ts });
    const b = makeStateSignal({ createdAt: ts });
    const [first, second] = sortStateSignals([a, b]);
    expect(first).toBe(a);
    expect(second).toBe(b);
  });

  it('does not mutate the original array', () => {
    const older = makeStateSignal({ createdAt: new Date('2024-01-01') });
    const newer = makeStateSignal({ createdAt: new Date('2024-01-02') });
    const original = [newer, older];
    sortStateSignals(original);
    expect(original[0]).toBe(newer);
  });
});

// ---------------------------------------------------------------------------
// mergeStateSignals
// ---------------------------------------------------------------------------

describe('mergeStateSignals', () => {
  it('returns empty array when no groups provided', () => {
    expect(mergeStateSignals()).toEqual([]);
  });

  it('returns signals from a single group sorted', () => {
    const older = makeStateSignal({ createdAt: new Date('2024-01-01') });
    const newer = makeStateSignal({ createdAt: new Date('2024-01-02') });
    const result = mergeStateSignals([newer, older]);
    expect(result[0].createdAt.getTime()).toBeLessThan(result[1].createdAt.getTime());
  });

  it('deduplicates signals with the same id', () => {
    const signal = makeStateSignal();
    const result = mergeStateSignals([signal], [signal]);
    expect(result).toHaveLength(1);
  });

  it('later group wins for duplicate ids', () => {
    const original = makeStateSignal();
    const updated = { ...original, metadata: { state: { version: 99 } } };
    const result = mergeStateSignals([original], [updated]);
    expect(result).toHaveLength(1);
    expect(result[0].metadata?.state?.version).toBe(99);
  });

  it('merges signals from multiple groups', () => {
    const s1 = makeStateSignal({ createdAt: new Date('2024-01-01') });
    const s2 = makeStateSignal({ createdAt: new Date('2024-01-02') });
    const s3 = makeStateSignal({ createdAt: new Date('2024-01-03') });
    const result = mergeStateSignals([s1], [s2], [s3]);
    expect(result).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// deriveStateSignalHistory
// ---------------------------------------------------------------------------

describe('deriveStateSignalHistory', () => {
  function makeSnapshot(overrides: Record<string, any> = {}): any {
    return makeStateSignal({
      metadata: { state: { id: 'state-1', threadId: 't-1', mode: 'snapshot', version: 1, cacheKey: 'ck' } },
      ...overrides,
    });
  }

  function makeDelta(overrides: Record<string, any> = {}): any {
    return makeStateSignal({
      metadata: { state: { id: 'state-1', threadId: 't-1', mode: 'delta', version: 2, cacheKey: 'ck' } },
      ...overrides,
    });
  }

  it('returns no snapshot and empty deltas for empty input', () => {
    const history = deriveStateSignalHistory([]);
    expect(history.lastSnapshot).toBeUndefined();
    expect(history.deltasSinceSnapshot).toEqual([]);
    expect(history.contextWindow.hasSnapshot).toBe(false);
  });

  it('identifies the last snapshot', () => {
    const snap = makeSnapshot({ createdAt: new Date('2024-01-01') });
    const history = deriveStateSignalHistory([snap]);
    expect(history.lastSnapshot).toBe(snap);
    expect(history.contextWindow.hasSnapshot).toBe(true);
  });

  it('collects deltas that come after the last snapshot', () => {
    const snap = makeSnapshot({ createdAt: new Date('2024-01-01') });
    const delta1 = makeDelta({ createdAt: new Date('2024-01-02') });
    const delta2 = makeDelta({ createdAt: new Date('2024-01-03') });
    const history = deriveStateSignalHistory([delta1, snap, delta2]);
    expect(history.deltasSinceSnapshot).toHaveLength(1);
    expect(history.deltasSinceSnapshot[0]).toBe(delta2);
  });

  it('uses the latest snapshot when multiple exist', () => {
    const snap1 = makeSnapshot({ createdAt: new Date('2024-01-01') });
    const snap2 = makeSnapshot({ createdAt: new Date('2024-01-03') });
    const delta = makeDelta({ createdAt: new Date('2024-01-02') });
    const history = deriveStateSignalHistory([snap1, delta, snap2]);
    expect(history.lastSnapshot).toBe(snap2);
    expect(history.deltasSinceSnapshot).toHaveLength(0);
  });

  it('hasSnapshot is false when only deltas exist', () => {
    const delta = makeDelta();
    const history = deriveStateSignalHistory([delta]);
    expect(history.contextWindow.hasSnapshot).toBe(false);
    expect(history.lastSnapshot).toBeUndefined();
  });

  it('includes all active signals sorted in activeStateSignals', () => {
    const snap = makeSnapshot({ createdAt: new Date('2024-01-01') });
    const delta = makeDelta({ createdAt: new Date('2024-01-02') });
    const history = deriveStateSignalHistory([delta, snap]);
    expect(history.activeStateSignals[0]).toBe(snap);
    expect(history.activeStateSignals[1]).toBe(delta);
  });
});

// ---------------------------------------------------------------------------
// createStateSignalInput
// ---------------------------------------------------------------------------

describe('createStateSignalInput', () => {
  it('throws when no id is provided and no defaultId option', () => {
    expect(() =>
      createStateSignalInput({ type: 'state', tagName: 'state', contents: '{}', cacheKey: 'ck' } as any),
    ).toThrow('state signal id is required');
  });

  it('throws when cacheKey is missing', () => {
    expect(() =>
      createStateSignalInput({ type: 'state', tagName: 'state', id: 'my-state', contents: '{}' } as any),
    ).toThrow('state signal cacheKey is required');
  });

  it('uses input.id when provided', () => {
    const result = createStateSignalInput({
      type: 'state',
      tagName: 'state',
      id: 'my-state',
      contents: '{}',
      cacheKey: 'ck-1',
    });
    expect(result.stateId).toBe('my-state');
  });

  it('uses defaultId when input.id is not provided', () => {
    const result = createStateSignalInput(
      { type: 'state', tagName: 'state', contents: '{}', cacheKey: 'ck-1' } as any,
      { defaultId: 'fallback-id' },
    );
    expect(result.stateId).toBe('fallback-id');
  });

  it('input.id takes precedence over defaultId', () => {
    const result = createStateSignalInput(
      { type: 'state', tagName: 'state', id: 'explicit', contents: '{}', cacheKey: 'ck-1' },
      { defaultId: 'fallback' },
    );
    expect(result.stateId).toBe('explicit');
  });

  it('returns a signal object', () => {
    const result = createStateSignalInput({
      type: 'state',
      tagName: 'state',
      id: 'my-state',
      contents: '{}',
      cacheKey: 'ck-1',
    });
    expect(result.signal).toBeDefined();
    expect(result.signal.__isCreatedSignal).toBe(true);
  });

  it('defaults mode to "snapshot" when not provided', () => {
    const result = createStateSignalInput({
      type: 'state',
      tagName: 'state',
      id: 'my-state',
      contents: '{}',
      cacheKey: 'ck-1',
    });
    expect(result.mode).toBe('snapshot');
  });

  it('uses input.mode when provided', () => {
    const result = createStateSignalInput({
      type: 'state',
      tagName: 'state',
      id: 'my-state',
      contents: '{}',
      cacheKey: 'ck-1',
      mode: 'delta',
    } as any);
    expect(result.mode).toBe('delta');
  });

  it('returns the cacheKey from the input', () => {
    const result = createStateSignalInput({
      type: 'state',
      tagName: 'state',
      id: 'my-state',
      contents: '{}',
      cacheKey: 'my-cache-key',
    });
    expect(result.cacheKey).toBe('my-cache-key');
  });
});
