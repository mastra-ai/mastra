import type { MastraScorer } from '../../evals/base';
import type { TargetType, RunStatus } from '../../storage/types';

/**
 * Configuration for running a dataset experiment against a target.
 */
export interface ExperimentConfig {
  /** ID of the dataset to run */
  datasetId: string;
  /** Type of target to execute against */
  targetType: TargetType;
  /** ID of the target (agent, workflow, etc.) */
  targetId: string;
  /** Scorers to apply - can be instances or registered scorer IDs */
  scorers?: (MastraScorer<any, any, any, any> | string)[];
  /** Pin to specific dataset version (default: latest) */
  version?: Date;
  /** Maximum concurrent executions (default: 5) */
  maxConcurrency?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Per-item execution timeout in milliseconds. Default: no timeout. */
  itemTimeout?: number;
  /** Pre-created experiment ID (for async trigger - skips run creation) */
  runId?: string;
}

/**
 * Result of executing a single dataset item.
 */
export interface ItemResult {
  /** ID of the dataset item */
  itemId: string;
  /** Version of the item when executed */
  itemVersion: Date;
  /** Input data that was passed to the target */
  input: unknown;
  /** Output from the target (null if failed) */
  output: unknown | null;
  /** Expected output from the dataset item */
  expectedOutput: unknown | null;
  /** Execution time in milliseconds */
  latency: number;
  /** Error message if execution failed */
  error: string | null;
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
  runId: string;
  /** Final status of the experiment */
  status: RunStatus;
  /** Total number of items in the dataset */
  totalItems: number;
  /** Number of items that succeeded */
  succeededCount: number;
  /** Number of items that failed */
  failedCount: number;
  /** When the experiment started */
  startedAt: Date;
  /** When the experiment completed */
  completedAt: Date;
  /** All item results with their scores */
  results: ItemWithScores[];
}
