import type { EvalVerdict, GateResult, RunEvalsResult, ThresholdConfig, TurnResult } from '@mastra/core/evals';

/** Per-threshold-scorer result, as reported in `RunEvalsResult.thresholdResults`. */
export type EvalThresholdResult = {
  id: string;
  passed: boolean;
  averageScore: number;
  threshold: ThresholdConfig;
};

/**
 * Serializable projection of a `RunEvalsResult` stored in `task.meta.mastraEval`.
 *
 * This is the contract between the test worker (which runs `runEvals`) and the
 * `MastraEvalsReporter` running in the main process. It intentionally excludes
 * raw agent/workflow payloads: `task.meta` is structured-cloned from worker to
 * main, so only lightweight, serializable data belongs here.
 */
export type MastraEvalMeta = {
  /**
   * Average score per scorer id across all data items. Categorized scorer
   * configs are flattened into dot-separated keys (e.g. `agent.my-scorer`,
   * `steps.step-1.my-scorer`).
   */
  scores: Record<string, number>;
  /** Number of data items evaluated. */
  totalItems: number;
  /** Present when gates or threshold-bearing scorers were provided. */
  verdict?: EvalVerdict;
  /** Per-gate results (averaged across all data items). */
  gateResults?: GateResult[];
  /** Per-threshold-scorer results (averaged across all data items). */
  thresholdResults?: EvalThresholdResult[];
  /** Per-turn assertion results, present when data items use `turns`. */
  turnResults?: TurnResult[];
};

declare module 'vitest' {
  interface TaskMeta {
    mastraEval?: MastraEvalMeta;
  }
}

/**
 * Flattens the `scores` record of a `RunEvalsResult` into `Record<string, number>`.
 * Categorized results (`agent`, `workflow`, `steps`, `trajectory`) are flattened
 * into dot-separated keys, e.g. `agent.my-scorer` or `steps.step-1.my-scorer`.
 */
function flattenScores(scores: Record<string, any>, prefix = '', out: Record<string, number> = {}) {
  for (const [id, value] of Object.entries(scores)) {
    const key = prefix ? `${prefix}.${id}` : id;
    if (typeof value === 'number') {
      out[key] = value;
    } else if (value && typeof value === 'object') {
      flattenScores(value, key, out);
    }
  }
  return out;
}

/**
 * Projects a `RunEvalsResult` into the serializable `MastraEvalMeta` shape
 * stored in `task.meta.mastraEval`.
 */
export function toEvalMeta(result: RunEvalsResult): MastraEvalMeta {
  const meta: MastraEvalMeta = {
    scores: flattenScores(result.scores),
    totalItems: result.summary.totalItems,
  };
  if (result.verdict !== undefined) meta.verdict = result.verdict;
  if (result.gateResults) meta.gateResults = result.gateResults.map(g => ({ ...g }));
  if (result.thresholdResults) meta.thresholdResults = result.thresholdResults.map(t => ({ ...t }));
  if (result.turnResults) meta.turnResults = result.turnResults;
  return meta;
}
