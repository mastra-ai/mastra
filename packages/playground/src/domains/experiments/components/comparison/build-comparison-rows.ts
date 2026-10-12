import type { ClientScoreRowData, CompareExperimentsResponse, DatasetExperimentResult } from '@mastra/client-js';

export interface ComparisonScore {
  scorerId: string;
  value: number | null;
  reason: string | null;
}

export interface ComparisonSide {
  /** False when the experiment never ran this item (e.g. dataset version drift). */
  present: boolean;
  output: unknown;
  metadata: Record<string, unknown> | null;
  comment: string | null;
  error: { message: string; stack?: string; code?: string } | null;
  startedAt: string | null;
  completedAt: string | null;
  scores: ComparisonScore[];
}

export type ComparisonRole = 'baseline' | 'contender';

/** One experiment's side of a row. */
export interface ComparisonColumn extends ComparisonSide {
  experimentId: string;
  role: ComparisonRole;
  /** This side minus the baseline, per scorer (null when either has no score). Null on the baseline itself. */
  deltas: Record<string, number | null> | null;
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
export type ScoresByItemId = Record<string, Array<Pick<ClientScoreRowData, 'scorerId' | 'reason'>>>;

interface BuildComparisonRowsParams {
  comparison: CompareExperimentsResponse | undefined;
  /** Compared experiment ids, baseline first. */
  experimentIds: string[];
  resultsById?: Record<string, DatasetExperimentResult[] | undefined>;
  scoresById?: Record<string, ScoresByItemId | undefined>;
}

const absentSide: ComparisonSide = {
  present: false,
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
): ComparisonSide => {
  if (!comparisonResult) return absentSide;

  // Reasons are not part of the result row: they live in the scores store.
  const reasonByScorerId = new Map<string, string | null>();
  for (const score of itemScores ?? []) {
    reasonByScorerId.set(score.scorerId, score.reason ?? null);
  }

  return {
    present: true,
    output: comparisonResult.output,
    metadata: detail?.metadata ?? null,
    comment: detail?.comment ?? null,
    error: detail?.error ?? null,
    startedAt: toIsoString(detail?.startedAt),
    completedAt: toIsoString(detail?.completedAt),
    scores: Object.entries(comparisonResult.scores)
      .map(([scorerId, value]) => ({ scorerId, value, reason: reasonByScorerId.get(scorerId) ?? null }))
      .sort((a, b) => a.scorerId.localeCompare(b.scorerId)),
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

/**
 * Joins the comparison payload with the per-experiment result rows and scorer runs so each
 * column can render output, metadata, comment, error, timings and scorer reasons for a single
 * item. The join key is `itemId`. The first of `experimentIds` is the baseline; every other
 * side carries its deltas against it.
 */
export const buildComparisonRows = ({
  comparison,
  experimentIds,
  resultsById,
  scoresById,
}: BuildComparisonRowsParams): ComparisonRow[] => {
  if (!comparison) return [];

  const indexes = new Map(experimentIds.map(id => [id, indexByItemId(resultsById?.[id])]));

  return comparison.items.map(item => {
    const sides = experimentIds.map(experimentId =>
      buildSide(
        item.results[experimentId],
        indexes.get(experimentId)?.get(item.itemId),
        scoresById?.[experimentId]?.[item.itemId],
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
      })),
    };
  });
};
