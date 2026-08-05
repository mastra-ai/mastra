import { describe, it, expect, vi } from 'vitest';

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
