/**
 * Run Comparison
 *
 * Compare two runs to detect score regressions.
 * Returns per-scorer deltas and per-item score diffs.
 */

import type { ScoreRowData } from '../../../evals/types';
import type { Mastra } from '../../../mastra';
import { computeScorerStats, isRegression } from './aggregate';
import type { CompareRunsConfig, ComparisonResult, ItemComparison, ScorerComparison, ScorerThreshold } from './types';

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
 * Compare two runs to detect score regressions.
 *
 * @param mastra - Mastra instance for storage access
 * @param config - Comparison configuration
 * @returns ComparisonResult with per-scorer and per-item comparisons
 *
 * @example
 * ```typescript
 * const result = await compareRuns(mastra, {
 *   runIdA: 'baseline-run-id',
 *   runIdB: 'candidate-run-id',
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
export async function compareRuns(mastra: Mastra, config: CompareRunsConfig): Promise<ComparisonResult> {
  const { runIdA, runIdB, thresholds = {} } = config;
  const warnings: string[] = [];

  // 1. Get storage
  const storage = mastra.getStorage();
  if (!storage) {
    throw new Error('Storage not configured. Configure storage in Mastra instance.');
  }

  const runsStore = await storage.getStore('runs');
  const scoresStore = await storage.getStore('scores');

  if (!runsStore) {
    throw new Error('RunsStorage not configured.');
  }
  if (!scoresStore) {
    throw new Error('ScoresStorage not configured.');
  }

  // 2. Load both runs
  const [runA, runB] = await Promise.all([runsStore.getRunById({ id: runIdA }), runsStore.getRunById({ id: runIdB })]);

  if (!runA) {
    throw new Error(`Run not found: ${runIdA}`);
  }
  if (!runB) {
    throw new Error(`Run not found: ${runIdB}`);
  }

  // 3. Check version mismatch
  const versionMismatch = runA.datasetVersion.getTime() !== runB.datasetVersion.getTime();
  if (versionMismatch) {
    warnings.push(
      `Runs have different dataset versions: ${runA.datasetVersion.toISOString()} vs ${runB.datasetVersion.toISOString()}`,
    );
  }

  // 4. Load results for both runs
  const [resultsA, resultsB] = await Promise.all([
    runsStore.listResults({ runId: runIdA, pagination: { page: 0, perPage: false } }),
    runsStore.listResults({ runId: runIdB, pagination: { page: 0, perPage: false } }),
  ]);

  // 5. Load scores for both runs
  const [scoresA, scoresB] = await Promise.all([
    scoresStore.listScoresByRunId({ runId: runIdA, pagination: { page: 0, perPage: false } }),
    scoresStore.listScoresByRunId({ runId: runIdB, pagination: { page: 0, perPage: false } }),
  ]);

  // 6. Handle empty runs
  if (resultsA.results.length === 0 && resultsB.results.length === 0) {
    warnings.push('Both runs have no results.');
    return buildEmptyResult(runA, runB, versionMismatch, warnings);
  }
  if (resultsA.results.length === 0) {
    warnings.push('Run A has no results.');
  }
  if (resultsB.results.length === 0) {
    warnings.push('Run B has no results.');
  }

  // 7. Find overlapping items
  const itemIdsA = new Set(resultsA.results.map(r => r.itemId));
  const itemIdsB = new Set(resultsB.results.map(r => r.itemId));
  const overlappingItemIds = [...itemIdsA].filter(id => itemIdsB.has(id));

  if (overlappingItemIds.length === 0) {
    warnings.push('No overlapping items between runs.');
  }

  // 8. Group scores by scorer and item
  const scoresMapA = groupScoresByScorerAndItem(scoresA.scores);
  const scoresMapB = groupScoresByScorerAndItem(scoresB.scores);

  // 9. Find all unique scorers
  const allScorerIds = new Set([...Object.keys(scoresMapA), ...Object.keys(scoresMapB)]);

  // 10. Build per-scorer comparison
  const scorers: Record<string, ScorerComparison> = {};
  let hasRegression = false;

  for (const scorerId of allScorerIds) {
    const scorerScoresA = scoresMapA[scorerId] ?? {};
    const scorerScoresB = scoresMapB[scorerId] ?? {};

    // Get scores as arrays for stats computation
    const scoresArrayA = Object.values(scorerScoresA);
    const scoresArrayB = Object.values(scorerScoresB);

    // Get threshold config for this scorer
    const thresholdConfig = thresholds[scorerId] ?? DEFAULT_THRESHOLD;
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

    scorers[scorerId] = {
      statsA,
      statsB,
      delta,
      regressed,
      threshold,
    };
  }

  // 11. Build per-item comparison
  const allItemIds = new Set([...itemIdsA, ...itemIdsB]);
  const items: ItemComparison[] = [];

  for (const itemId of allItemIds) {
    const inBothRuns = itemIdsA.has(itemId) && itemIdsB.has(itemId);

    // Build scores for this item
    const itemScoresA: Record<string, number | null> = {};
    const itemScoresB: Record<string, number | null> = {};

    for (const scorerId of allScorerIds) {
      const scoreA = scoresMapA[scorerId]?.[itemId];
      const scoreB = scoresMapB[scorerId]?.[itemId];

      itemScoresA[scorerId] = scoreA?.score ?? null;
      itemScoresB[scorerId] = scoreB?.score ?? null;
    }

    items.push({
      itemId,
      inBothRuns,
      scoresA: itemScoresA,
      scoresB: itemScoresB,
    });
  }

  return {
    runA: {
      id: runA.id,
      datasetVersion: runA.datasetVersion,
    },
    runB: {
      id: runB.id,
      datasetVersion: runB.datasetVersion,
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
function groupScoresByScorerAndItem(scores: ScoreRowData[]): Record<string, Record<string, ScoreRowData>> {
  const result: Record<string, Record<string, ScoreRowData>> = {};

  for (const score of scores) {
    const scorerId = score.scorerId;
    const itemId = score.entityId; // entityId is the item ID for run scores

    if (!result[scorerId]) {
      result[scorerId] = {};
    }
    result[scorerId][itemId] = score;
  }

  return result;
}

/**
 * Build an empty comparison result for edge cases.
 */
function buildEmptyResult(
  runA: { id: string; datasetVersion: Date },
  runB: { id: string; datasetVersion: Date },
  versionMismatch: boolean,
  warnings: string[],
): ComparisonResult {
  return {
    runA: {
      id: runA.id,
      datasetVersion: runA.datasetVersion,
    },
    runB: {
      id: runB.id,
      datasetVersion: runB.datasetVersion,
    },
    versionMismatch,
    hasRegression: false,
    scorers: {},
    items: [],
    warnings,
  };
}
