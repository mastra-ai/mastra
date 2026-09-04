import { describe, it, expect, vi } from 'vitest';

import { createScorer } from '../evals';
import { runScorer } from '../evals/hooks';
import { AvailableHooks, executeHook } from '../hooks';
import { InMemoryStore } from '../storage/mock';

import { Mastra } from './index';

// A scorer run for an entity/scorer this Mastra does not own — exactly what an
// empty internal/ephemeral Mastra sees when the real Mastra runs a scorer,
// since the scorer hook lives on a shared, process-wide emitter.
const foreignScorerRun = {
  entity: { id: 'agent-owned-by-another-mastra' },
  entityType: 'AGENT',
  scorer: { id: 'a-scorer-this-mastra-never-registered' },
  input: 'in',
  output: 'out',
} as any;

async function flushHook() {
  // executeHook defers via setImmediate and the handler awaits internally.
  await new Promise(resolve => setTimeout(resolve, 20));
}

describe('scorer hook teardown', () => {
  it('only runs a scorer on the Mastra instance that emitted the hook', async () => {
    const sharedScorer = createScorer({
      id: 'shared-instance-scorer',
      name: 'Shared instance scorer',
      description: 'A scorer registered on more than one Mastra instance',
    }).generateScore(() => 1);
    const run = vi.spyOn(sharedScorer, 'run').mockImplementation(async input => ({
      ...input,
      runId: input.runId ?? 'shared-instance-scorer-run',
      score: 1,
    }));

    const owner = new Mastra({
      storage: new InMemoryStore(),
      scorers: { sharedScorer },
    });
    const nonOwner = new Mastra({
      storage: new InMemoryStore(),
      scorers: { sharedScorer },
    });
    const nonOwnerLookup = vi.spyOn(nonOwner, 'getScorerById');
    const nonOwnerException = vi.spyOn(nonOwner.getLogger(), 'trackException');

    try {
      runScorer({
        mastra: owner,
        scorerId: sharedScorer.id,
        scorerObject: { scorer: sharedScorer },
        runId: 'shared-instance-run',
        input: 'in',
        output: 'out',
        requestContext: {},
        entity: { id: 'shared-instance-agent' },
        structuredOutput: false,
        source: 'LIVE',
        entityType: 'AGENT',
      });

      await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
      await flushHook();

      expect(nonOwnerLookup).not.toHaveBeenCalled();
      expect(nonOwnerException).not.toHaveBeenCalled();
    } finally {
      owner.__unregisterHooks();
      nonOwner.__unregisterHooks();
    }
  });

  it('an empty Mastra logs a failed-hook error for a scorer it does not own', async () => {
    const mastra = new Mastra({ storage: new InMemoryStore() });
    const trackException = vi.spyOn(mastra.getLogger(), 'trackException');

    executeHook(AvailableHooks.ON_SCORER_RUN, foreignScorerRun);
    await flushHook();

    // Reproduces the reported flooding: the handler fires and cannot resolve the
    // scorer, so it logs an exception on every scorer run.
    expect(trackException).toHaveBeenCalled();

    mastra.__unregisterHooks();
  });

  it('does not fire the scorer hook after __unregisterHooks', async () => {
    const mastra = new Mastra({ storage: new InMemoryStore() });
    const trackException = vi.spyOn(mastra.getLogger(), 'trackException');

    mastra.__unregisterHooks();

    executeHook(AvailableHooks.ON_SCORER_RUN, foreignScorerRun);
    await flushHook();

    expect(trackException).not.toHaveBeenCalled();
  });

  it('__unregisterHooks is idempotent', () => {
    const mastra = new Mastra({ storage: new InMemoryStore() });
    expect(() => {
      mastra.__unregisterHooks();
      mastra.__unregisterHooks();
    }).not.toThrow();
  });
});
