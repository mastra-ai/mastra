import type { MastraScorer } from '../../evals/base';
import type { Mastra } from '../../mastra';
import type { TargetType, ExperimentStatus } from '../../storage/types';

/**
 * A single data item for inline experiment data.
 * Internal — not publicly exported from @mastra/core.
 */
export interface DataItem<I = unknown, E = unknown> {
  /** Unique ID (auto-generated if omitted) */
  id?: string;
  /** Input data passed to task */
  input: I;
  /** Ground truth for scoring */
  groundTruth?: E;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Internal configuration for running a dataset experiment.
 * Not publicly exported — users interact via Dataset.startExperiment().
 * All new fields are optional — existing internal callers are unaffected.
 */
export interface ExperimentConfig<I = unknown, O = unknown, E = unknown> {
  // === Data source (pick one — Dataset always injects datasetId) ===

  /** ID of dataset in storage (injected by Dataset) */
  datasetId?: string;
  /** Override data source — inline array or async factory (bypasses storage load) */
  data?: DataItem<I, E>[] | (() => Promise<DataItem<I, E>[]>);

  // === Task execution (pick one) ===

  /** Registry-based target type (existing) */
  targetType?: TargetType;
  /** Registry-based target ID (existing) */
  targetId?: string;
  /** Inline task function (sync or async) */
  task?: (args: {
    input: I;
    mastra: Mastra;
    groundTruth?: E;
    metadata?: Record<string, unknown>;
    signal?: AbortSignal;
  }) => O | Promise<O>;

  // === Scoring ===

  /** Scorers — MastraScorer instances or string IDs */
  scorers?: (MastraScorer<any, any, any, any> | string)[];

  // === Options ===

  /** Pin to specific dataset version (default: latest). Only applies when datasetId is used. */
  version?: number;
  /** Maximum concurrent executions (default: 5) */
  maxConcurrency?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Per-item execution timeout in milliseconds */
  itemTimeout?: number;
  /** Maximum retries per item on failure (default: 0 = no retries). Abort errors are never retried. */
  maxRetries?: number;
  /** Pre-created experiment ID (for async trigger — skips experiment creation). */
  experimentId?: string;
  /** Experiment name (used for display / grouping) */
  name?: string;
  /** Experiment description */
  description?: string;
  /** Arbitrary metadata for the experiment */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for starting an experiment on a dataset.
 * The dataset is always the data source — no datasetId/data needed.
 */
export type StartExperimentConfig<I = unknown, O = unknown, E = unknown> = Omit<
  ExperimentConfig<I, O, E>,
  'datasetId' | 'data' | 'experimentId'
>;

/**
 * Result of executing a single dataset item.
 */
export interface ItemResult {
  /** ID of the dataset item */
  itemId: string;
  /** Dataset version of the item when executed */
  itemVersion: number;
  /** Input data that was passed to the target */
  input: unknown;
  /** Output from the target (null if failed) */
  output: unknown | null;
  /** Expected output from the dataset item */
  groundTruth: unknown | null;
  /** Structured error if execution failed */
  error: { message: string; stack?: string; code?: string } | null;
  /** When execution started */
  startedAt: Date;
  /** When execution completed */
  completedAt: Date;
  /** Number of retry attempts */
  retryCount: number;
}

/**
 * Result from a single scorer for an item.
 */
export interface ScorerResult {
  /** ID of the scorer */
  scorerId: string;
  /** Display name of the scorer */
  scorerName: string;
  /** Computed score (null if scorer failed) */
  score: number | null;
  /** Reason/explanation for the score */
  reason: string | null;
  /** Error message if scorer failed */
  error: string | null;
}

/**
 * Item result with all scorer results attached.
 */
export interface ItemWithScores extends ItemResult {
  /** Results from all scorers for this item */
  scores: ScorerResult[];
}

/**
 * Summary of an entire dataset experiment.
 */
export interface ExperimentSummary {
  /** Unique ID of this experiment */
  experimentId: string;
  /** Final status of the experiment */
  status: ExperimentStatus;
  /** Total number of items in the dataset */
  totalItems: number;
  /** Number of items that succeeded */
  succeededCount: number;
  /** Number of items that failed */
  failedCount: number;
  /** Number of items skipped (e.g. due to abort) */
  skippedCount: number;
  /** True if run completed but some items failed */
  completedWithErrors: boolean;
  /** When the experiment started */
  startedAt: Date;
  /** When the experiment completed */
  completedAt: Date;
  /** All item results with their scores */
  results: ItemWithScores[];
}
