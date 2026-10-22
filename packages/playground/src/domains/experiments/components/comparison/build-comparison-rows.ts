import type { ClientScoreRowData, CompareExperimentsResponse, DatasetExperimentResult } from '@mastra/client-js';
import type { ExperimentItemUsage, ExperimentUsage } from '@mastra/react/hooks/experiments';
import { totalTokens } from './comparison-metric-format';

export interface ComparisonScore {
  scorerId: string;
  value: number | null;
  reason: string | null;
  /** Categorical label the scorer gave next to the number, e.g. `failing`. */
  label: string | null;
}

export interface ComparisonSide {
  /** False when the experiment never ran this item (e.g. dataset version drift). */
  present: boolean;
  /** The experiment's target type, which decides the shape of `output`. */
  targetType: DatasetExperimentResult['targetType'] | null;
  output: unknown;
  metadata: Record<string, unknown> | null;
  comment: string | null;
  error: { message: string; stack?: string; code?: string } | null;
  startedAt: string | null;
  completedAt: string | null;
  scores: ComparisonScore[];
  /** Trace of this side's run, when it was recorded. */
  traceId?: string;
  /** Tokens and estimated cost of this side's run. Undefined when unknown (no metrics, or a target without model calls). */
  usage?: ExperimentItemUsage;
}

export type ComparisonRole = 'baseline' | 'contender';

/** One experiment's side of a row. */
export interface ComparisonColumn extends ComparisonSide {
  experimentId: string;
  role: ComparisonRole;
  /** This side minus the baseline, per scorer (null when either has no score). Null on the baseline itself. */
  deltas: Record<string, number | null> | null;
  /** This side's run duration minus the baseline's, in ms. Null on the baseline or when either is unknown. */
  durationDeltaMs: number | null;
  /** This side's estimated cost minus the baseline's. Undefined on the baseline, when either is unknown, or when units differ. */
  costDelta?: number;
  /** This side's input plus output tokens minus the baseline's. Undefined on the baseline or when either is unknown. */
  tokenDelta?: number;
  /** This side's average score minus the baseline's. Undefined on the baseline or when either has no score. */
  averageScoreDelta?: number;
}

export interface ComparisonRow {
  itemId: string;
  input: unknown;
  groundTruth: unknown;
  /** One side per compared experiment, in `experimentIds` order (baseline first). */
  sides: ComparisonColumn[];
}

/**
 * Scorer runs grouped by dataset item id, as `useScoresByExperimentId` returns them.
 * Structurally narrowed to what the join needs, so `ClientScoreRowData[]` fits.
 */
export type ScoresByItemId = Record<string, Array<Pick<ClientScoreRowData, 'scorerId' | 'reason' | 'label'>>>;

interface BuildComparisonRowsParams {
  comparison: CompareExperimentsResponse | undefined;
  /** Compared experiment ids, baseline first. */
  experimentIds: string[];
  resultsById?: Record<string, DatasetExperimentResult[] | undefined>;
  scoresById?: Record<string, ScoresByItemId | undefined>;
  usageById?: Record<string, ExperimentUsage | undefined>;
}

const absentSide: ComparisonSide = {
  present: false,
  targetType: null,
  output: null,
  metadata: null,
  comment: null,
  error: null,
  startedAt: null,
  completedAt: null,
  scores: [],
};

const toIsoString = (value: string | Date | null | undefined): string | null => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
};

const indexByItemId = (results?: DatasetExperimentResult[]) => {
  const index = new Map<string, DatasetExperimentResult>();
  for (const result of results ?? []) {
    index.set(result.itemId, result);
  }
  return index;
};

const buildSide = (
  comparisonResult: { output: unknown; scores: Record<string, number | null> } | null | undefined,
  detail: DatasetExperimentResult | undefined,
  itemScores: ScoresByItemId[string] | undefined,
  usageByTraceId: ExperimentUsage['traces'] | undefined,
): ComparisonSide => {
  if (!comparisonResult) return absentSide;

  // Reasons and labels are not part of the result row: they live in the scores store.
  const scoreByScorerId = new Map<string, ScoresByItemId[string][number]>();
  for (const score of itemScores ?? []) {
    scoreByScorerId.set(score.scorerId, score);
  }

  return {
    present: true,
    targetType: detail?.targetType ?? null,
    output: comparisonResult.output,
    metadata: detail?.metadata ?? null,
    comment: detail?.comment ?? null,
    error: detail?.error ?? null,
    startedAt: toIsoString(detail?.startedAt),
    completedAt: toIsoString(detail?.completedAt),
    scores: Object.entries(comparisonResult.scores)
      .map(([scorerId, value]) => ({
        scorerId,
        value,
        reason: scoreByScorerId.get(scorerId)?.reason ?? null,
        label: scoreByScorerId.get(scorerId)?.label ?? null,
      }))
      .sort((a, b) => a.scorerId.localeCompare(b.scorerId)),
    traceId: detail?.traceId ?? undefined,
    usage: detail?.traceId ? usageByTraceId?.[detail.traceId] : undefined,
  };
};

const deltasAgainst = (baseline: ComparisonSide, side: ComparisonSide): Record<string, number | null> => {
  const deltas: Record<string, number | null> = {};
  for (const scorerId of new Set([...baseline.scores, ...side.scores].map(score => score.scorerId))) {
    const baselineValue = baseline.scores.find(score => score.scorerId === scorerId)?.value ?? null;
    const sideValue = side.scores.find(score => score.scorerId === scorerId)?.value ?? null;
    deltas[scorerId] = baselineValue != null && sideValue != null ? sideValue - baselineValue : null;
  }
  return deltas;
};

/** Run duration of one side in ms, or null when either timestamp is missing. */
export function sideDurationMs(side: {
  startedAt?: string | Date | null;
  completedAt?: string | Date | null;
}): number | null {
  if (!side.startedAt || !side.completedAt) return null;
  return new Date(side.completedAt).getTime() - new Date(side.startedAt).getTime();
}

/** Mean of the scores that have a value, or null when none has. */
export function sideAverageScore(side: { scores: Array<{ value: number | null }> }): number | null {
  const values = side.scores.map(score => score.value).filter((value): value is number => value != null);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

const averageScoreDeltaAgainst = (baseline: ComparisonSide, side: ComparisonSide): number | undefined => {
  const baselineAverage = sideAverageScore(baseline);
  const sideAverage = sideAverageScore(side);
  return baselineAverage != null && sideAverage != null ? sideAverage - baselineAverage : undefined;
};

const durationDeltaAgainst = (baseline: ComparisonSide, side: ComparisonSide): number | null => {
  const baselineMs = sideDurationMs(baseline);
  const sideMs = sideDurationMs(side);
  return baselineMs != null && sideMs != null ? sideMs - baselineMs : null;
};

const costDeltaAgainst = (baseline: ComparisonSide, side: ComparisonSide): number | undefined => {
  const baselineCost = baseline.usage?.estimatedCost;
  const sideCost = side.usage?.estimatedCost;
  if (baselineCost === undefined || sideCost === undefined) return undefined;
  return baseline.usage?.costUnit === side.usage?.costUnit ? sideCost - baselineCost : undefined;
};

const tokenDeltaAgainst = (baseline: ComparisonSide, side: ComparisonSide): number | undefined => {
  const baselineTokens = totalTokens(baseline.usage);
  const sideTokens = totalTokens(side.usage);
  return baselineTokens !== undefined && sideTokens !== undefined ? sideTokens - baselineTokens : undefined;
};

/**
 * Joins the comparison payload with the per-experiment result rows, scorer runs and usage so each
 * column can render output, metadata, comment, error, timings, scorer reasons and cost for a
 * single item. Usage is matched through the result's trace id. The join key is `itemId`. The first
 * of `experimentIds` is the baseline; every other side carries its deltas against it.
 */
export const buildComparisonRows = ({
  comparison,
  experimentIds,
  resultsById,
  scoresById,
  usageById,
}: BuildComparisonRowsParams): ComparisonRow[] => {
  if (!comparison) return [];

  const indexes = new Map(experimentIds.map(id => [id, indexByItemId(resultsById?.[id])]));

  return comparison.items.map(item => {
    const sides = experimentIds.map(experimentId =>
      buildSide(
        item.results[experimentId],
        indexes.get(experimentId)?.get(item.itemId),
        scoresById?.[experimentId]?.[item.itemId],
        usageById?.[experimentId]?.traces,
      ),
    );
    const [baseline] = sides;

    return {
      itemId: item.itemId,
      input: item.input,
      groundTruth: item.groundTruth,
      sides: sides.map((side, index) => ({
        ...side,
        experimentId: experimentIds[index],
        role: index === 0 ? 'baseline' : 'contender',
        deltas: index === 0 ? null : deltasAgainst(baseline, side),
        durationDeltaMs: index === 0 ? null : durationDeltaAgainst(baseline, side),
        costDelta: index === 0 ? undefined : costDeltaAgainst(baseline, side),
        tokenDelta: index === 0 ? undefined : tokenDeltaAgainst(baseline, side),
        averageScoreDelta: index === 0 ? undefined : averageScoreDeltaAgainst(baseline, side),
      })),
    };
  });
};
