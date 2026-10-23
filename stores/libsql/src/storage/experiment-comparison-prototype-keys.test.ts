import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LibSQLStore } from './index';

// Item, scorer, and experiment IDs are user data; names that exist on Object.prototype
// must group and report like any other ID once they come back from a real adapter.
const PROTOTYPE_NAMES = ['constructor', 'toString', '__proto__'] as const;

describe.each(['in-memory', 'libsql'] as const)('experiment comparison with prototype-named IDs: %s', adapter => {
  let storage: InMemoryStore | LibSQLStore;

  beforeEach(async () => {
    storage = adapter === 'libsql' ? new LibSQLStore({ id: 'prototype-keys', url: ':memory:' }) : new InMemoryStore();
    await storage.init();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await storage.close();
  });

  it('compares items, scorers, and experiments named after Object.prototype keys', async () => {
    const mastra = new Mastra({ storage, logger: false });
    const dataset = await mastra.datasets.create({ name: 'prototype keys' });
    // The public API has no item ID field; both adapters take the item ID from the first
    // crypto.randomUUID() call in addItem. Stub it so items carry IDs an imported row could have.
    for (const id of PROTOTYPE_NAMES) {
      vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(id as ReturnType<typeof crypto.randomUUID>);
      const item = await dataset.addItem({ input: `input for ${id}` });
      expect(item.id).toBe(id);
    }

    for (const [experimentId, base] of [
      ['__proto__', 0.2],
      ['constructor', 0.6],
    ] as const) {
      await dataset.createExperiment({ id: experimentId, name: experimentId });
      for (const itemId of PROTOTYPE_NAMES) {
        for (const attempt of [0, 1]) {
          await dataset.submitExperimentResult({
            experimentId,
            itemId,
            attempt,
            output: `${itemId} attempt ${attempt}`,
            scores: PROTOTYPE_NAMES.map(scorerId => ({ scorerId, score: base + attempt * 0.1 })),
          });
        }
      }
      await dataset.finalizeExperiment({ experimentId });
    }

    const comparison = await mastra.datasets.compareExperiments({ experimentIds: ['__proto__', 'constructor'] });

    expect(comparison.baselineId).toBe('__proto__');
    expect(comparison.items.map(item => item.itemId).sort()).toEqual([...PROTOTYPE_NAMES].sort());
    for (const item of comparison.items) {
      expect(Object.keys(item.results).sort()).toEqual(['__proto__', 'constructor']);
      const baseline = item.results['__proto__']!.scores;
      const candidate = item.results['constructor']!.scores;
      expect(Object.keys(baseline).sort()).toEqual([...PROTOTYPE_NAMES].sort());
      expect(Object.keys(candidate).sort()).toEqual([...PROTOTYPE_NAMES].sort());
      for (const scorerId of PROTOTYPE_NAMES) {
        expect(baseline[scorerId]).toBeCloseTo(0.25);
        expect(candidate[scorerId]).toBeCloseTo(0.65);
      }
    }
  });
});
