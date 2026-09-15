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

export interface ComparisonRow {
  itemId: string;
  input: unknown;
  groundTruth: unknown;
  baseline: ComparisonSide;
  contender: ComparisonSide;
  /** Contender minus baseline, per scorer. Null when either side has no score. */
  deltas: Record<string, number | null>;
}

/**
 * Scorer runs grouped by dataset item id, as `useScoresByExperimentId` returns them.
 * Structurally narrowed to what the join needs, so `ClientScoreRowData[]` fits.
 */
export type ScoresByItemId = Record<string, Array<Pick<ClientScoreRowData, 'scorerId' | 'reason'>>>;

interface BuildComparisonRowsParams {
  comparison: CompareExperimentsResponse | undefined;
  baselineId: string;
  contenderId: string;
  baselineResults?: DatasetExperimentResult[];
  contenderResults?: DatasetExperimentResult[];
  baselineScores?: ScoresByItemId;
  contenderScores?: ScoresByItemId;
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

/**
 * Joins the pairwise comparison payload with the per-experiment result rows and
 * scorer runs so each column can render output, metadata, comment, error,
 * timings and scorer reasons for a single item. The join key is `itemId`.
 */
export const buildComparisonRows = ({
  comparison,
  baselineId,
  contenderId,
  baselineResults,
  contenderResults,
  baselineScores,
  contenderScores,
}: BuildComparisonRowsParams): ComparisonRow[] => {
  if (!comparison) return [];

  const baselineIndex = indexByItemId(baselineResults);
  const contenderIndex = indexByItemId(contenderResults);

  return comparison.items.map(item => {
    const baseline = buildSide(item.results[baselineId], baselineIndex.get(item.itemId), baselineScores?.[item.itemId]);
    const contender = buildSide(
      item.results[contenderId],
      contenderIndex.get(item.itemId),
      contenderScores?.[item.itemId],
    );

    const deltas: Record<string, number | null> = {};
    for (const scorerId of new Set([...baseline.scores, ...contender.scores].map(score => score.scorerId))) {
      const baselineValue = baseline.scores.find(score => score.scorerId === scorerId)?.value ?? null;
      const contenderValue = contender.scores.find(score => score.scorerId === scorerId)?.value ?? null;
      deltas[scorerId] = baselineValue != null && contenderValue != null ? contenderValue - baselineValue : null;
    }

    return {
      itemId: item.itemId,
      input: item.input,
      groundTruth: item.groundTruth,
      baseline,
      contender,
      deltas,
    };
  });
};
