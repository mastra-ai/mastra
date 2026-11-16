import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage/mock';
import type { Dataset } from '../dataset';
import { compareExperiments } from '../experiment/analytics/compare';

// Item, scorer, and experiment IDs are user data. Names that exist on Object.prototype
// must group and report like any other ID.
const PROTOTYPE_NAMES = ['constructor', 'toString', '__proto__'] as const;
const SCORER_IDS = [...PROTOTYPE_NAMES, 'hasOwnProperty'];

afterEach(() => {
  vi.restoreAllMocks();
});

// The public API has no item ID field: adapters generate it with crypto.randomUUID().
// Stub that one call so the stored item carries the ID an imported or legacy row could have.
async function addItemWithId(dataset: Dataset, id: string, input: string) {
  vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(id as ReturnType<typeof crypto.randomUUID>);
  const item = await dataset.addItem({ input });
  expect(item.id).toBe(id);
  return item;
}

async function setup() {
  const mastra = new Mastra({ storage: new InMemoryStore(), logger: false });
  const dataset = await mastra.datasets.create({ name: 'prototype keys' });
  for (const id of PROTOTYPE_NAMES) {
    await addItemWithId(dataset, id, `input for ${id}`);
  }
  return { mastra, dataset };
}

async function submitRun(dataset: Dataset, experimentId: string | undefined, scoreFor: (itemIndex: number) => number) {
  const run = await dataset.createExperiment({ name: `run ${experimentId ?? 'generated'}`, id: experimentId });
  for (const [itemIndex, itemId] of PROTOTYPE_NAMES.entries()) {
    // Two trials per item so the comparison has to group attempts under each key.
    for (const attempt of [0, 1]) {
      await dataset.submitExperimentResult({
        experimentId: run.experimentId,
        itemId,
        attempt,
        output: `${itemId} attempt ${attempt}`,
        scores: SCORER_IDS.map(scorerId => ({ scorerId, score: scoreFor(itemIndex) + attempt * 0.1 })),
      });
    }
  }
  await dataset.finalizeExperiment({ experimentId: run.experimentId });
  return run.experimentId;
}

describe('experiment comparison with Object.prototype names as IDs', () => {
  it('groups scores per scorer and item when IDs match Object.prototype names', async () => {
    const { mastra, dataset } = await setup();
    const baselineId = await submitRun(dataset, undefined, itemIndex => itemIndex * 0.2);
    const candidateId = await submitRun(dataset, undefined, itemIndex => itemIndex * 0.2 + 0.3);

    const comparison = await compareExperiments(mastra, { experimentIdA: baselineId, experimentIdB: candidateId });

    expect(Object.keys(comparison.scorers).sort()).toEqual([...SCORER_IDS].sort());
    for (const scorerId of SCORER_IDS) {
      expect(Object.hasOwn(comparison.scorers, scorerId)).toBe(true);
      const scorer = comparison.scorers[scorerId]!;
      // Item means are 0.05, 0.25, 0.45 for A and 0.35, 0.55, 0.75 for B.
      expect(scorer.statsA).toMatchObject({ totalItems: 3, scoreCount: 3 });
      expect(scorer.statsB).toMatchObject({ totalItems: 3, scoreCount: 3 });
      expect(scorer.statsA.avgScore).toBeCloseTo(0.25);
      expect(scorer.statsB.avgScore).toBeCloseTo(0.55);
      expect(scorer.delta).toBeCloseTo(0.3);
      expect(scorer.threshold).toBe(0);
      expect(scorer.regressed).toBe(false);
    }
    expect(comparison.hasRegression).toBe(false);
    expect(Object.keys(JSON.parse(JSON.stringify(comparison.scorers))).sort()).toEqual([...SCORER_IDS].sort());

    expect(comparison.items.map(item => item.itemId).sort()).toEqual([...PROTOTYPE_NAMES].sort());
    for (const [itemIndex, itemId] of PROTOTYPE_NAMES.entries()) {
      const item = comparison.items.find(entry => entry.itemId === itemId)!;
      expect(item.inBothExperiments).toBe(true);
      expect(Object.keys(item.scoresA).sort()).toEqual([...SCORER_IDS].sort());
      for (const scorerId of SCORER_IDS) {
        expect(Object.hasOwn(item.scoresA, scorerId)).toBe(true);
        expect(item.scoresA[scorerId]).toBeCloseTo(itemIndex * 0.2 + 0.05);
        expect(item.scoresB[scorerId]).toBeCloseTo(itemIndex * 0.2 + 0.35);
      }
    }
  });

  it('applies thresholds only for scorer IDs the caller configured', async () => {
    const { mastra, dataset } = await setup();
    const baselineId = await submitRun(dataset, undefined, () => 0.6);
    const candidateId = await submitRun(dataset, undefined, () => 0.5);

    const comparison = await compareExperiments(mastra, {
      experimentIdA: baselineId,
      experimentIdB: candidateId,
      thresholds: { toString: { value: 0.2 } },
    });

    expect(comparison.scorers['toString']).toMatchObject({ threshold: 0.2, regressed: false });
    for (const scorerId of ['constructor', '__proto__', 'hasOwnProperty']) {
      expect(comparison.scorers[scorerId]).toMatchObject({ threshold: 0, regressed: true });
    }
    expect(comparison.hasRegression).toBe(true);
  });

  it('keeps results for experiments whose IDs match Object.prototype names', async () => {
    const { mastra, dataset } = await setup();
    const baselineId = await submitRun(dataset, '__proto__', () => 0.4);
    const candidateId = await submitRun(dataset, 'constructor', () => 0.8);

    const comparison = await mastra.datasets.compareExperiments({ experimentIds: [baselineId, candidateId] });

    expect(comparison.baselineId).toBe('__proto__');
    expect(comparison.items).toHaveLength(3);
    for (const item of comparison.items) {
      expect(Object.keys(item.results).sort()).toEqual(['__proto__', 'constructor']);
      expect(item.results['__proto__']!.scores['constructor']).toBeCloseTo(0.45);
      expect(item.results['constructor']!.scores['__proto__']).toBeCloseTo(0.85);
    }
  });
});
