import { describe, expect, it } from 'vitest';
import {
  CONTEXT_INSPECTION_MAX_DEPTH,
  CONTEXT_INSPECTION_MAX_NODES,
  ExecutionEnginePolicy,
  hasNonJsonContextValue,
} from '../execution-engine';
import type { ExecutionEngine } from '../execution-engine';
import type { AgentStreamsConfig } from '../types';

const values = [
  undefined,
  true,
  {},
  { cleanupTimeoutMs: 0 },
  { executionEngine: 'durable' },
  { executionEngine: 'evented' },
  { executionEngine: false },
  false,
] satisfies (boolean | AgentStreamsConfig | undefined)[];

describe('registered execution policy', () => {
  for (const hostEngine of [undefined, false, 'durable', 'evented'] satisfies (ExecutionEngine | undefined)[]) {
    it.each(values)('preserves opt-outs and explicit selection for %j with host ' + String(hostEngine), durable => {
      const policy = new ExecutionEnginePolicy(durable);
      const shouldCache = () => false;
      const shouldPersistSnapshot = () => true;
      expect(
        policy.register({ executionEngine: hostEngine, cleanupTimeoutMs: 123, shouldCache, shouldPersistSnapshot }),
      ).toBeUndefined();
      const explicit = typeof durable === 'object' ? durable : {};
      expect(policy.engine).toBe(durable === false ? false : (explicit.executionEngine ?? hostEngine ?? false));
      if (durable === false) expect(policy.durable).toBe(false);
      else
        expect(policy.durable).toEqual({
          ...explicit,
          executionEngine: explicit.executionEngine ?? hostEngine,
          cleanupTimeoutMs: explicit.cleanupTimeoutMs ?? 123,
          shouldCache,
          shouldPersistSnapshot,
        });
    });
  }

  it('does not lock provisional inspection and retains the first registered defaults', () => {
    const policy = new ExecutionEnginePolicy(undefined);
    expect(policy.engine).toBe(false);
    const shouldCache = () => false;
    policy.register({ executionEngine: 'evented', shouldCache, cleanupTimeoutMs: 0 });
    expect(policy.engine).toBe('evented');
    expect(policy.register({ executionEngine: 'evented', cleanupTimeoutMs: 999 })).toBeUndefined();
    expect(policy.durable).toEqual({ executionEngine: 'evented', shouldCache, cleanupTimeoutMs: 0 });
    expect(policy.register({ executionEngine: 'durable' })).toBe('locked');
    expect(policy.engine).toBe('evented');
  });

  it('locks a first hostless call while still accepting stream defaults at registration', () => {
    const policy = new ExecutionEnginePolicy(undefined);
    policy.freeze();
    expect(policy.register({ executionEngine: 'durable', cleanupTimeoutMs: 0 })).toBe('locked');
    expect(policy.engine).toBe(false);
    expect(policy.durable).toEqual({ executionEngine: false, cleanupTimeoutMs: 0 });
    expect(policy.inherited).toBe(false);
  });

  it('does not allow mutable config aliases to change lifetime selection', () => {
    const config: AgentStreamsConfig = { executionEngine: 'evented' };
    const policy = new ExecutionEnginePolicy(config);
    policy.freeze();
    config.executionEngine = 'durable';
    const effective = policy.durable;
    if (typeof effective === 'object') effective.executionEngine = false;
    expect(policy.engine).toBe('evented');
  });

  it.each(values)('makes wrapper ownership irreversible for %j', durable => {
    const policy = new ExecutionEnginePolicy(durable);
    policy.register({ executionEngine: 'evented', cleanupTimeoutMs: 0 });
    policy.ownByWrapper();
    expect(policy.durable).toEqual({ executionEngine: false });
    expect(policy.engine).toBe(false);
    expect(policy.inherited).toBe(false);
    expect(policy.register({ executionEngine: 'durable' })).toBe('wrapper-owned');
    expect(policy.durable).toEqual({ executionEngine: false });
  });
});

describe('best-effort caller context diagnostics', () => {
  it.each([() => {}, Symbol('closure'), 1n, { nested: { fn: () => {} } }, new Map()])(
    'finds unsupported values without serializing them',
    value => {
      expect(hasNonJsonContextValue(value)).toBe(true);
    },
  );

  it('distinguishes shared JSON references from ancestor cycles', () => {
    const shared = { value: 1 };
    expect(hasNonJsonContextValue({ a: shared, b: shared })).toBe(false);
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    expect(hasNonJsonContextValue(cycle)).toBe(true);
  });

  it('does not invoke getters or custom serialization and tolerates reflection failure', () => {
    let calls = 0;
    const value = Object.defineProperty({}, 'value', {
      enumerable: true,
      get() {
        calls++;
        throw new Error('getter');
      },
    });
    Object.defineProperty(value, 'toJSON', {
      get() {
        calls++;
        throw new Error('serializer');
      },
    });
    expect(hasNonJsonContextValue(value)).toBe(false);
    expect(calls).toBe(0);
    expect(
      hasNonJsonContextValue(
        new Proxy(
          {},
          {
            ownKeys() {
              throw new Error('proxy');
            },
          },
        ),
      ),
    ).toBe(false);
  });

  it('includes the depth boundary but stops beyond it', () => {
    const nest = (depth: number): unknown => (depth ? { value: nest(depth - 1) } : 1n);
    expect(hasNonJsonContextValue(nest(CONTEXT_INSPECTION_MAX_DEPTH))).toBe(true);
    expect(hasNonJsonContextValue(nest(CONTEXT_INSPECTION_MAX_DEPTH + 1))).toBe(false);
  });

  it('includes the node boundary but stops beyond it', () => {
    expect(hasNonJsonContextValue([...Array(CONTEXT_INSPECTION_MAX_NODES - 2).fill(null), 1n])).toBe(true);
    expect(hasNonJsonContextValue([...Array(CONTEXT_INSPECTION_MAX_NODES - 1).fill(null), 1n])).toBe(false);
  });
});
