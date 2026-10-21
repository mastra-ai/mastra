/**
 * Experiment Comparison
 *
 * Compare two experiments to detect score regressions.
 * Returns per-scorer deltas and per-item score diffs.
 */

import type { ScoreRowData } from '../../../evals/types';
import type { Mastra } from '../../../mastra';
import { computeScorerStats, isRegression } from './aggregate';
import type {
  CompareExperimentsConfig,
  ComparisonResult,
  ItemComparison,
  ScorerComparison,
  ScorerThreshold,
} from './types';

/**
 * Default threshold when not specified: no tolerance for regression.
 */
const DEFAULT_THRESHOLD: ScorerThreshold = {
  value: 0,
  direction: 'higher-is-better',
};

/**
 * Default pass threshold for computing pass rate.
 */
const DEFAULT_PASS_THRESHOLD = 0.5;

/**
 * Compare two experiments to detect score regressions.
 *
 * @param mastra - Mastra instance for storage access
 * @param config - Comparison configuration
 * @returns ComparisonResult with per-scorer and per-item comparisons
 *
 * @example
 * ```typescript
 * const result = await compareExperiments(mastra, {
 *   experimentIdA: 'baseline-experiment-id',
 *   experimentIdB: 'candidate-experiment-id',
 *   thresholds: {
 *     'accuracy': { value: 0.05, direction: 'higher-is-better' },
 *     'latency': { value: 100, direction: 'lower-is-better' },
 *   },
 * });
 *
 * if (result.hasRegression) {
 *   console.log('Quality regression detected!');
 * }
 * ```
 */
export async function compareExperiments(mastra: Mastra, config: CompareExperimentsConfig): Promise<ComparisonResult> {
  const { experimentIdA, experimentIdB, thresholds = {} } = config;
  const warnings: string[] = [];

  // 1. Get storage
  const storage = mastra.getStorage();
  if (!storage) {
    throw new Error('Storage not configured. Configure storage in Mastra instance.');
  }

  const experimentsStore = await storage.getStore('experiments');
  const scoresStore = await storage.getStore('scores');

  if (!experimentsStore) {
    throw new Error('ExperimentsStorage not configured.');
  }
  if (!scoresStore) {
    throw new Error('ScoresStorage not configured.');
  }

  // 2. Load both experiments
  const [experimentA, experimentB] = await Promise.all([
    experimentsStore.getExperimentById({ id: experimentIdA }),
    experimentsStore.getExperimentById({ id: experimentIdB }),
  ]);

  if (!experimentA) {
    throw new Error(`Experiment not found: ${experimentIdA}`);
  }
  if (!experimentB) {
    throw new Error(`Experiment not found: ${experimentIdB}`);
  }

  // 3. Check version mismatch
  const versionMismatch = experimentA.datasetVersion !== experimentB.datasetVersion;
  if (versionMismatch) {
    warnings.push(
      `Experiments have different dataset versions: ${experimentA.datasetVersion} vs ${experimentB.datasetVersion}`,
    );
  }

  // 4. Load results for both experiments
  const [resultsA, resultsB] = await Promise.all([
    experimentsStore.listExperimentResults({ experimentId: experimentIdA, pagination: { page: 0, perPage: false } }),
    experimentsStore.listExperimentResults({ experimentId: experimentIdB, pagination: { page: 0, perPage: false } }),
  ]);

  // 5. Load scores for both experiments
  const [scoresA, scoresB] = await Promise.all([
    scoresStore.listScoresByRunId({ runId: experimentIdA, pagination: { page: 0, perPage: false } }),
    scoresStore.listScoresByRunId({ runId: experimentIdB, pagination: { page: 0, perPage: false } }),
  ]);

  // 6. Handle empty experiments
  if (resultsA.results.length === 0 && resultsB.results.length === 0) {
    warnings.push('Both experiments have no results.');
    return buildEmptyResult(experimentA, experimentB, versionMismatch, warnings);
  }
  if (resultsA.results.length === 0) {
    warnings.push('Experiment A has no results.');
  }
  if (resultsB.results.length === 0) {
    warnings.push('Experiment B has no results.');
  }

  // 7. Find overlapping items
  const itemIdsA = new Set(resultsA.results.map(r => r.itemId));
  const itemIdsB = new Set(resultsB.results.map(r => r.itemId));
  const overlappingItemIds = [...itemIdsA].filter(id => itemIdsB.has(id));

  if (overlappingItemIds.length === 0) {
    warnings.push('No overlapping items between experiments.');
  }

  // 8. Group scores by scorer and item
  const scoresMapA = groupScoresByScorerAndItem(scoresA.scores);
  const scoresMapB = groupScoresByScorerAndItem(scoresB.scores);

  // 9. Find all unique scorers
  const allScorerIds = new Set([...scoresMapA.keys(), ...scoresMapB.keys()]);

  // 10. Build per-scorer comparison.
  // Scorer and item IDs are user data, so key them with Maps and build output records with
  // Object.fromEntries; IDs like "constructor" or "__proto__" must stay ordinary own keys.
  const scorerEntries: [string, ScorerComparison][] = [];
  let hasRegression = false;

  for (const scorerId of allScorerIds) {
    // Get scores as arrays for stats computation
    const scoresArrayA = [...(scoresMapA.get(scorerId)?.values() ?? [])];
    const scoresArrayB = [...(scoresMapB.get(scorerId)?.values() ?? [])];

    // Get threshold config for this scorer
    const thresholdConfig =
      (Object.hasOwn(thresholds, scorerId) ? thresholds[scorerId] : undefined) ?? DEFAULT_THRESHOLD;
    const threshold = thresholdConfig.value;
    const direction = thresholdConfig.direction ?? 'higher-is-better';

    // Compute stats
    const statsA = computeScorerStats(scoresArrayA, DEFAULT_PASS_THRESHOLD);
    const statsB = computeScorerStats(scoresArrayB, DEFAULT_PASS_THRESHOLD);

    // Compute delta and check regression
    const delta = statsB.avgScore - statsA.avgScore;
    const regressed = isRegression(delta, threshold, direction);

    if (regressed) {
      hasRegression = true;
    }

    scorerEntries.push([scorerId, { statsA, statsB, delta, regressed, threshold }]);
  }
  const scorers: Record<string, ScorerComparison> = Object.fromEntries(scorerEntries);

  // 11. Build per-item comparison
  const allItemIds = new Set([...itemIdsA, ...itemIdsB]);
  const items: ItemComparison[] = [];

  for (const itemId of allItemIds) {
    const inBothExperiments = itemIdsA.has(itemId) && itemIdsB.has(itemId);

    // Build scores for this item
    const scorerIds = [...allScorerIds];

    items.push({
      itemId,
      inBothExperiments,
      scoresA: Object.fromEntries(
        scorerIds.map(scorerId => [scorerId, scoresMapA.get(scorerId)?.get(itemId)?.score ?? null]),
      ),
      scoresB: Object.fromEntries(
        scorerIds.map(scorerId => [scorerId, scoresMapB.get(scorerId)?.get(itemId)?.score ?? null]),
      ),
    });
  }

  return {
    experimentA: {
      id: experimentA.id,
      datasetVersion: experimentA.datasetVersion,
    },
    experimentB: {
      id: experimentB.id,
      datasetVersion: experimentB.datasetVersion,
    },
    versionMismatch,
    hasRegression,
    scorers,
    items,
    warnings,
  };
}

/**
 * Group scores by scorer ID, then by item ID.
 */
function groupScoresByScorerAndItem(scores: ScoreRowData[]): Map<string, Map<string, ScoreRowData>> {
  const grouped = new Map<string, Map<string, ScoreRowData[]>>();

  for (const score of scores) {
    const itemId = score.entityId; // entityId is the item ID for experiment scores
    let items = grouped.get(score.scorerId);
    if (!items) {
      items = new Map();
      grouped.set(score.scorerId, items);
    }
    const attempts = items.get(itemId);
    if (attempts) {
      attempts.push(score);
    } else {
      items.set(itemId, [score]);
    }
  }

  const result = new Map<string, Map<string, ScoreRowData>>();
  for (const [scorerId, items] of grouped) {
    const averaged = new Map<string, ScoreRowData>();
    result.set(scorerId, averaged);
    for (const [itemId, attempts] of items) {
      // Average trials per item so items with more attempts do not get extra weight.
      const first = attempts[0]!;
      const validScores = attempts.map(attempt => attempt.score).filter(score => score !== null && score !== undefined);
      averaged.set(itemId, {
        ...first,
        score:
          validScores.length > 0
            ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
            : first.score,
      });
    }
  }

  return result;
}

/**
 * Build an empty comparison result for edge cases.
 */
function buildEmptyResult(
  experimentA: { id: string; datasetVersion: number | null },
  experimentB: { id: string; datasetVersion: number | null },
  versionMismatch: boolean,
  warnings: string[],
): ComparisonResult {
  return {
    experimentA: {
      id: experimentA.id,
      datasetVersion: experimentA.datasetVersion,
    },
    experimentB: {
      id: experimentB.id,
      datasetVersion: experimentB.datasetVersion,
    },
    versionMismatch,
    hasRegression: false,
    scorers: {},
    items: [],
    warnings,
  };
}
