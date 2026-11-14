import { describe, expect, it } from 'vitest';
import { ExecutionEnginePolicy } from '../execution-policy';
import type { ExecutionEngine } from '../execution-policy';
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
