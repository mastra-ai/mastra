import type { Scorecard, SelectionConfig, TrainingMethod } from '../types';
import { hashMessages } from './hash';

/**
 * Apply selection criteria to filter and limit scorecards.
 *
 * For DPO, selection is done at the CASE level (keeping all candidates for selected cases).
 * For SFT, selection is done at the individual scorecard level.
 */
export function applySelection(
  scorecards: Scorecard[],
  config: SelectionConfig,
  method: TrainingMethod = 'sft',
): { selected: Scorecard[]; holdout: Scorecard[] } {
  // For DPO, use case-level selection to preserve multiple candidates per case
  if (method === 'dpo') {
    return applyDpoSelection(scorecards, config);
  }

  return applySftSelection(scorecards, config);
}

/**
 * SFT selection - operates on individual scorecards.
 */
function applySftSelection(
  scorecards: Scorecard[],
  config: SelectionConfig,
): { selected: Scorecard[]; holdout: Scorecard[] } {
  let filtered = [...scorecards];

  // Filter by minimum score
  if (config.minScore !== undefined) {
    filtered = filtered.filter(s => s.compositeScore >= config.minScore!);
  }

  // Filter by gate pass
  filtered = filtered.filter(s => s.passedGates);

  // Deduplicate
  if (config.dedupe) {
    filtered = deduplicateScorecards(filtered);
  }

  // Balance by category
  if (config.balance) {
    filtered = balanceScorecards(filtered, config.balance.field, config.balance.maxPerCategory);
  }

  // Split holdout
  let selected = filtered;
  let holdout: Scorecard[] = [];

  if (config.holdoutRatio && config.holdoutRatio > 0 && config.holdoutRatio < 1) {
    const { train, test } = splitHoldout(filtered, config.holdoutRatio);
    selected = train;
    holdout = test;
  }

  // Apply max examples limit
  if (config.maxExamples && selected.length > config.maxExamples) {
    // Sort by composite score and take top N
    selected = selected.sort((a, b) => b.compositeScore - a.compositeScore).slice(0, config.maxExamples);
  }

  return { selected, holdout };
}

/**
 * DPO selection - operates at the CASE level, preserving all candidates per case.
 *
 * For DPO, we need multiple candidates per case to form preference pairs.
 * Selection criteria are applied to determine which CASES to include,
 * then ALL candidates for those cases are kept.
 */
function applyDpoSelection(
  scorecards: Scorecard[],
  config: SelectionConfig,
): { selected: Scorecard[]; holdout: Scorecard[] } {
  // Group scorecards by case ID
  const caseGroups = new Map<string, Scorecard[]>();
  for (const scorecard of scorecards) {
    const caseId = scorecard.run.caseId;
    if (!caseGroups.has(caseId)) {
      caseGroups.set(caseId, []);
    }
    caseGroups.get(caseId)!.push(scorecard);
  }

  // Filter cases: a case is included if it has at least 2 candidates
  // and at least one candidate passes gates
  const validCases: Array<{ caseId: string; scorecards: Scorecard[]; bestScore: number }> = [];

  for (const [caseId, group] of caseGroups) {
    // Need at least 2 candidates for DPO
    if (group.length < 2) {
      continue;
    }

    // At least one must pass gates
    const hasPassingGate = group.some(s => s.passedGates);
    if (!hasPassingGate) {
      continue;
    }

    // If minScore is set, at least one candidate must meet it
    if (config.minScore !== undefined) {
      const hasPassingScore = group.some(s => s.compositeScore >= config.minScore!);
      if (!hasPassingScore) {
        continue;
      }
    }

    // Calculate best score for this case (for ranking)
    const bestScore = Math.max(...group.map(s => s.compositeScore));
    validCases.push({ caseId, scorecards: group, bestScore });
  }

  // Sort cases by best score (descending)
  validCases.sort((a, b) => b.bestScore - a.bestScore);

  // Split into train/holdout at the CASE level
  let trainCases = validCases;
  let holdoutCases: typeof validCases = [];

  if (config.holdoutRatio && config.holdoutRatio > 0 && config.holdoutRatio < 1) {
    const shuffled = [...validCases].sort(() => Math.random() - 0.5);
    const splitIndex = Math.floor(shuffled.length * (1 - config.holdoutRatio));
    trainCases = shuffled.slice(0, splitIndex);
    holdoutCases = shuffled.slice(splitIndex);
  }

  // Apply max examples limit at the CASE level
  // (maxExamples for DPO means max cases, since each case produces 1 preference pair)
  if (config.maxExamples && trainCases.length > config.maxExamples) {
    trainCases = trainCases.slice(0, config.maxExamples);
  }

  // Flatten back to scorecards
  const selected = trainCases.flatMap(c => c.scorecards);
  const holdout = holdoutCases.flatMap(c => c.scorecards);

  console.log(`[DPO Selection] ${validCases.length} valid cases from ${caseGroups.size} total cases`);
  console.log(
    `[DPO Selection] Train: ${trainCases.length} cases (${selected.length} scorecards), Holdout: ${holdoutCases.length} cases (${holdout.length} scorecards)`,
  );

  return { selected, holdout };
}

/**
 * Deduplicate scorecards by input hash.
 */
function deduplicateScorecards(scorecards: Scorecard[]): Scorecard[] {
  const seen = new Set<string>();
  const result: Scorecard[] = [];

  for (const scorecard of scorecards) {
    const hash = hashMessages(scorecard.run.input.messages);
    if (!seen.has(hash)) {
      seen.add(hash);
      result.push(scorecard);
    }
  }

  return result;
}

/**
 * Balance scorecards by a metadata field.
 */
function balanceScorecards(scorecards: Scorecard[], field: string, maxPerCategory?: number): Scorecard[] {
  const groups = new Map<string, Scorecard[]>();

  for (const scorecard of scorecards) {
    const value = String(scorecard.run.input.metadata?.[field] ?? 'unknown');
    if (!groups.has(value)) {
      groups.set(value, []);
    }
    groups.get(value)!.push(scorecard);
  }

  const result: Scorecard[] = [];
  const limit = maxPerCategory || Math.ceil(scorecards.length / groups.size);

  for (const [, group] of groups) {
    // Sort by score and take top N per category
    const sorted = [...group].sort((a, b) => b.compositeScore - a.compositeScore);
    result.push(...sorted.slice(0, limit));
  }

  return result;
}

/**
 * Split scorecards into train and holdout sets.
 */
function splitHoldout(scorecards: Scorecard[], ratio: number): { train: Scorecard[]; test: Scorecard[] } {
  // Shuffle first
  const shuffled = [...scorecards].sort(() => Math.random() - 0.5);

  const splitIndex = Math.floor(shuffled.length * (1 - ratio));
  return {
    train: shuffled.slice(0, splitIndex),
    test: shuffled.slice(splitIndex),
  };
}

/**
 * Get selection statistics.
 */
export function getSelectionStats(
  original: Scorecard[],
  selected: Scorecard[],
  holdout: Scorecard[],
): {
  originalCount: number;
  selectedCount: number;
  holdoutCount: number;
  filteredOut: number;
  avgSelectedScore: number;
  avgHoldoutScore: number;
} {
  const avgSelectedScore =
    selected.length > 0 ? selected.reduce((sum, s) => sum + s.compositeScore, 0) / selected.length : 0;

  const avgHoldoutScore =
    holdout.length > 0 ? holdout.reduce((sum, s) => sum + s.compositeScore, 0) / holdout.length : 0;

  return {
    originalCount: original.length,
    selectedCount: selected.length,
    holdoutCount: holdout.length,
    filteredOut: original.length - selected.length - holdout.length,
    avgSelectedScore,
    avgHoldoutScore,
  };
}
