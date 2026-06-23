import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createWorkflow } from '../workflows/create';
import { createStep } from '../workflows/workflow';
import { createRunScope, createRunScopeKey } from './run-scope';
import { Mastra } from './index';

const dummyStep = createStep({
  id: 'noop',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  execute: async () => ({}),
});

function makeWorkflow(id: string) {
  return createWorkflow({ id, inputSchema: z.object({}), outputSchema: z.object({}) })
    .then(dummyStep)
    .commit();
}

function makeMastra() {
  return new Mastra({ logger: false });
}

describe('RunScope', () => {
  describe('typed key/value bag', () => {
    it('round-trips set/get for a primitive value', () => {
      const scope = createRunScope();
      const KEY = createRunScopeKey<string>('greeting');
      scope.set(KEY, 'hi');
      expect(scope.get(KEY)).toBe('hi');
    });

    it('round-trips a class instance without copying', () => {
      class Live {
        constructor(public n: number) {}
      }
      const scope = createRunScope();
      const KEY = createRunScopeKey<Live>('live');
      const instance = new Live(42);
      scope.set(KEY, instance);
      expect(scope.get(KEY)).toBe(instance);
    });

    it('returns undefined for an absent key', () => {
      const scope = createRunScope();
      const KEY = createRunScopeKey<number>('missing');
      expect(scope.get(KEY)).toBeUndefined();
      expect(scope.has(KEY)).toBe(false);
    });

    it('getOrThrow throws on missing slot with the key label in the message', () => {
      const scope = createRunScope();
      const KEY = createRunScopeKey<number>('saveQueueManager');
      expect(() => scope.getOrThrow(KEY)).toThrow(/saveQueueManager/);
    });

    it('getOrThrow returns the value when present', () => {
      const scope = createRunScope();
      const KEY = createRunScopeKey<number>('count');
      scope.set(KEY, 7);
      expect(scope.getOrThrow(KEY)).toBe(7);
    });

    it('delete removes the slot', () => {
      const scope = createRunScope();
      const KEY = createRunScopeKey<string>('tmp');
      scope.set(KEY, 'x');
      scope.delete(KEY);
      expect(scope.has(KEY)).toBe(false);
      expect(scope.get(KEY)).toBeUndefined();
    });

    it('two keys with the same label do not collide', () => {
      const scope = createRunScope();
      const A = createRunScopeKey<string>('same');
      const B = createRunScopeKey<string>('same');
      scope.set(A, 'aaa');
      scope.set(B, 'bbb');
      expect(scope.get(A)).toBe('aaa');
      expect(scope.get(B)).toBe('bbb');
    });

    it('size reflects populated slots', () => {
      const scope = createRunScope();
      const A = createRunScopeKey<number>('a');
      const B = createRunScopeKey<number>('b');
      expect(scope.size).toBe(0);
      scope.set(A, 1);
      scope.set(B, 2);
      expect(scope.size).toBe(2);
      scope.delete(A);
      expect(scope.size).toBe(1);
    });
  });
});

describe('Mastra runScope lifecycle', () => {
  describe('explicit create / release', () => {
    it('__getRunScope returns undefined when no scope exists', () => {
      const m = makeMastra();
      expect(m.__getRunScope('never-created')).toBeUndefined();
    });

    it('__createRunScope is idempotent — same runId returns same scope', () => {
      const m = makeMastra();
      const a = m.__createRunScope('run-1');
      const b = m.__createRunScope('run-1');
      expect(a).toBe(b);
    });

    it('__createRunScope refcount keeps the scope alive across a single release', () => {
      const m = makeMastra();
      const KEY = createRunScopeKey<string>('value');
      const scope = m.__createRunScope('run-1');
      m.__createRunScope('run-1'); // 2nd hold
      scope.set(KEY, 'still here');

      m.__releaseRunScope('run-1');
      expect(m.__getRunScope('run-1')?.get(KEY)).toBe('still here');

      m.__releaseRunScope('run-1');
      expect(m.__getRunScope('run-1')).toBeUndefined();
    });

    it('extra __releaseRunScope calls beyond the refcount are no-ops', () => {
      const m = makeMastra();
      m.__createRunScope('run-1');
      m.__releaseRunScope('run-1');
      // Already gone — second release must not throw.
      expect(() => m.__releaseRunScope('run-1')).not.toThrow();
      expect(m.__getRunScope('run-1')).toBeUndefined();
    });
  });

  describe('pairing with __registerInternalWorkflow', () => {
    it('register creates the scope; unregister drops it', () => {
      const m = makeMastra();
      m.__registerInternalWorkflow(makeWorkflow('agentic-loop'), 'run-1');
      expect(m.__getRunScope('run-1')).toBeDefined();

      m.__unregisterInternalWorkflow('agentic-loop', 'run-1');
      expect(m.__getRunScope('run-1')).toBeUndefined();
    });

    it('multiple registrations sharing a runId keep the scope alive until the last unregister', () => {
      const m = makeMastra();
      const KEY = createRunScopeKey<string>('shared');

      m.__registerInternalWorkflow(makeWorkflow('agentic-loop'), 'run-1');
      m.__registerInternalWorkflow(makeWorkflow('execution-workflow'), 'run-1');
      m.__getRunScope('run-1')!.set(KEY, 'persist');

      m.__unregisterInternalWorkflow('agentic-loop', 'run-1');
      expect(m.__getRunScope('run-1')?.get(KEY)).toBe('persist');

      m.__unregisterInternalWorkflow('execution-workflow', 'run-1');
      expect(m.__getRunScope('run-1')).toBeUndefined();
    });

    it('unscoped registrations do not allocate a runScope', () => {
      const m = makeMastra();
      m.__registerInternalWorkflow(makeWorkflow('bg-task'));
      expect(m.__getRunScope('bg-task')).toBeUndefined();
    });

    it('hydration before registration: __createRunScope then register holds the same scope', () => {
      const m = makeMastra();
      const KEY = createRunScopeKey<string>('hydrated');
      const scope = m.__createRunScope('run-1');
      scope.set(KEY, 'loop()');

      m.__registerInternalWorkflow(makeWorkflow('agentic-loop'), 'run-1');
      expect(m.__getRunScope('run-1')).toBe(scope);
      expect(m.__getRunScope('run-1')?.get(KEY)).toBe('loop()');

      // Both holds must release before the scope dies.
      m.__unregisterInternalWorkflow('agentic-loop', 'run-1');
      expect(m.__getRunScope('run-1')).toBe(scope);
      m.__releaseRunScope('run-1');
      expect(m.__getRunScope('run-1')).toBeUndefined();
    });

    it('re-registering the same workflow id+runId does not double-bump the refcount', () => {
      const m = makeMastra();
      const wf = makeWorkflow('agentic-loop');
      m.__registerInternalWorkflow(wf, 'run-1');
      m.__registerInternalWorkflow(wf, 'run-1'); // idempotent

      m.__unregisterInternalWorkflow('agentic-loop', 'run-1');
      expect(m.__getRunScope('run-1')).toBeUndefined();
    });
  });

  describe('TTL sweep', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('evicts both the workflow registration and the runScope after the TTL', () => {
      const m = makeMastra();
      m.__registerInternalWorkflow(makeWorkflow('agentic-loop'), 'stale-run');
      expect(m.__getRunScope('stale-run')).toBeDefined();

      // Advance past the TTL.
      vi.setSystemTime(Date.now() + Mastra.INTERNAL_WORKFLOW_TTL_MS + 1000);

      // Sweep runs lazily on the next registration.
      m.__registerInternalWorkflow(makeWorkflow('agentic-loop'), 'fresh-run');

      expect(m.__hasInternalWorkflow('agentic-loop', 'stale-run')).toBe(false);
      expect(m.__getRunScope('stale-run')).toBeUndefined();
      expect(m.__getRunScope('fresh-run')).toBeDefined();
    });

    it('releases the correct scope when the runId contains a colon', () => {
      const m = makeMastra();
      // runIds are caller-controlled; nothing prevents a custom id from
      // containing the workflowId:runId delimiter we use internally.
      const colonRunId = 'tenant:abc:run-42';
      m.__registerInternalWorkflow(makeWorkflow('agentic-loop'), colonRunId);
      expect(m.__getRunScope(colonRunId)).toBeDefined();

      vi.setSystemTime(Date.now() + Mastra.INTERNAL_WORKFLOW_TTL_MS + 1000);
      m.__registerInternalWorkflow(makeWorkflow('agentic-loop'), 'fresh-run');

      // The stale entry must have released the *full* runId, not a substring
      // sliced from `lastIndexOf(':')`.
      expect(m.__getRunScope(colonRunId)).toBeUndefined();
      expect(m.__getRunScope('fresh-run')).toBeDefined();
    });
  });
});
