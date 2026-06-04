import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod/v4';
import { createWorkflow } from '../workflows/create';
import { createStep } from '../workflows/workflow';
import { Mastra } from './index';

/**
 * Tests for the run-scoped internal workflow registry and lazy TTL sweep.
 *
 * The registry supports two kinds of entries:
 * 1. Unscoped (singleton): keyed by `${id}` — used for background tasks,
 *    score-traces, etc.  These live forever.
 * 2. Run-scoped: keyed by `${id}:${runId}` — used for per-run agentic-loop
 *    and prepare-stream workflows.  These carry a timestamp and are evicted
 *    by a lazy sweep when they exceed `Mastra.INTERNAL_WORKFLOW_TTL_MS`.
 */

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

describe('internal workflow registry', () => {
  describe('unscoped (singleton) registration', () => {
    it('registers and retrieves a workflow by id', () => {
      const m = makeMastra();
      const wf = makeWorkflow('bg-task');
      m.__registerInternalWorkflow(wf);

      expect(m.__hasInternalWorkflow('bg-task')).toBe(true);
      expect(m.__getInternalWorkflow('bg-task')).toBe(wf);
    });

    it('throws when retrieving an unregistered id', () => {
      const m = makeMastra();
      expect(() => m.__getInternalWorkflow('missing')).toThrow(/not found/i);
    });

    it('returns false for __hasInternalWorkflow on missing id', () => {
      const m = makeMastra();
      expect(m.__hasInternalWorkflow('missing')).toBe(false);
    });
  });

  describe('run-scoped registration', () => {
    it('registers and retrieves a workflow by id+runId', () => {
      const m = makeMastra();
      const wf = makeWorkflow('agentic-loop');
      m.__registerInternalWorkflow(wf, 'run-1');

      expect(m.__hasInternalWorkflow('agentic-loop', 'run-1')).toBe(true);
      expect(m.__getInternalWorkflow('agentic-loop', 'run-1')).toBe(wf);
    });

    it('does not collide with another runId for the same workflow id', () => {
      const m = makeMastra();
      const wf1 = makeWorkflow('agentic-loop');
      const wf2 = makeWorkflow('agentic-loop');
      m.__registerInternalWorkflow(wf1, 'run-1');
      m.__registerInternalWorkflow(wf2, 'run-2');

      expect(m.__getInternalWorkflow('agentic-loop', 'run-1')).toBe(wf1);
      expect(m.__getInternalWorkflow('agentic-loop', 'run-2')).toBe(wf2);
    });

    it('falls back to unscoped entry when run-scoped is missing', () => {
      const m = makeMastra();
      const singleton = makeWorkflow('shared-wf');
      m.__registerInternalWorkflow(singleton); // unscoped

      // Lookup with a runId that was never registered should fall back
      expect(m.__hasInternalWorkflow('shared-wf', 'any-run')).toBe(true);
      expect(m.__getInternalWorkflow('shared-wf', 'any-run')).toBe(singleton);
    });

    it('prefers run-scoped entry over unscoped when both exist', () => {
      const m = makeMastra();
      const singleton = makeWorkflow('wf');
      const scoped = makeWorkflow('wf');
      m.__registerInternalWorkflow(singleton);
      m.__registerInternalWorkflow(scoped, 'run-1');

      expect(m.__getInternalWorkflow('wf', 'run-1')).toBe(scoped);
      // Unscoped lookup still returns the singleton
      expect(m.__getInternalWorkflow('wf')).toBe(singleton);
    });

    it('unregisters only the run-scoped entry, leaving unscoped intact', () => {
      const m = makeMastra();
      const singleton = makeWorkflow('wf');
      const scoped = makeWorkflow('wf');
      m.__registerInternalWorkflow(singleton);
      m.__registerInternalWorkflow(scoped, 'run-1');

      m.__unregisterInternalWorkflow('wf', 'run-1');

      // Run-scoped gone — falls back to singleton
      expect(m.__getInternalWorkflow('wf', 'run-1')).toBe(singleton);
      expect(m.__getInternalWorkflow('wf')).toBe(singleton);
    });

    it('unregister on missing key is a no-op', () => {
      const m = makeMastra();
      expect(() => m.__unregisterInternalWorkflow('nope', 'run-1')).not.toThrow();
    });
  });

  describe('lazy TTL sweep', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('evicts run-scoped entries older than TTL on next registration', () => {
      const m = makeMastra();
      const old = makeWorkflow('loop');
      m.__registerInternalWorkflow(old, 'run-old');

      // Advance past TTL
      vi.advanceTimersByTime(Mastra.INTERNAL_WORKFLOW_TTL_MS + 1);

      // Trigger sweep by registering a new run-scoped entry
      const fresh = makeWorkflow('loop');
      m.__registerInternalWorkflow(fresh, 'run-fresh');

      // Old entry should be evicted
      expect(m.__hasInternalWorkflow('loop', 'run-old')).toBe(false);
      // Fresh entry should still be present
      expect(m.__hasInternalWorkflow('loop', 'run-fresh')).toBe(true);
      expect(m.__getInternalWorkflow('loop', 'run-fresh')).toBe(fresh);
    });

    it('does NOT evict run-scoped entries within TTL', () => {
      const m = makeMastra();
      const recent = makeWorkflow('loop');
      m.__registerInternalWorkflow(recent, 'run-recent');

      // Advance to just under the TTL
      vi.advanceTimersByTime(Mastra.INTERNAL_WORKFLOW_TTL_MS - 1000);

      // Trigger sweep
      const fresh = makeWorkflow('loop');
      m.__registerInternalWorkflow(fresh, 'run-trigger');

      // Recent entry should still be present
      expect(m.__hasInternalWorkflow('loop', 'run-recent')).toBe(true);
    });

    it('does NOT evict unscoped (singleton) entries regardless of age', () => {
      const m = makeMastra();
      const singleton = makeWorkflow('bg-task');
      m.__registerInternalWorkflow(singleton); // no runId

      vi.advanceTimersByTime(Mastra.INTERNAL_WORKFLOW_TTL_MS * 10);

      // Trigger sweep
      const trigger = makeWorkflow('trigger');
      m.__registerInternalWorkflow(trigger, 'run-x');

      // Singleton should survive
      expect(m.__hasInternalWorkflow('bg-task')).toBe(true);
      expect(m.__getInternalWorkflow('bg-task')).toBe(singleton);
    });

    it('evicts multiple stale entries in a single sweep', () => {
      const m = makeMastra();
      m.__registerInternalWorkflow(makeWorkflow('loop'), 'run-a');
      m.__registerInternalWorkflow(makeWorkflow('loop'), 'run-b');
      m.__registerInternalWorkflow(makeWorkflow('loop'), 'run-c');

      // Advance past TTL for all three (registered at the same time)
      vi.advanceTimersByTime(Mastra.INTERNAL_WORKFLOW_TTL_MS + 1);

      // Trigger sweep
      m.__registerInternalWorkflow(makeWorkflow('loop'), 'run-fresh');

      expect(m.__hasInternalWorkflow('loop', 'run-a')).toBe(false);
      expect(m.__hasInternalWorkflow('loop', 'run-b')).toBe(false);
      expect(m.__hasInternalWorkflow('loop', 'run-c')).toBe(false);
      expect(m.__hasInternalWorkflow('loop', 'run-fresh')).toBe(true);
    });

    it('sweep is not triggered by unscoped registration', () => {
      const m = makeMastra();
      m.__registerInternalWorkflow(makeWorkflow('loop'), 'run-old');

      vi.advanceTimersByTime(Mastra.INTERNAL_WORKFLOW_TTL_MS + 1);

      // Register unscoped — sweep should NOT fire
      m.__registerInternalWorkflow(makeWorkflow('singleton'));

      // Old run-scoped entry should still exist (no sweep happened)
      expect(m.__hasInternalWorkflow('loop', 'run-old')).toBe(true);
    });
  });
});
