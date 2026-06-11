import type { AgentScorerConfig, WorkflowScorerConfig } from '../../evals';
import type { MastraScorer } from '../../evals/base';
import type { Mastra } from '../../mastra';
import type { VersionOverrides } from '../../mastra/types';
import type { TargetType, ExperimentStatus } from '../../storage/types';
import type { ToolMockConfig, ToolReplayMatching, ToolReplayOnMiss, ToolReplayReport } from './replay';

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
  /** Per-item request context merged over the global request context (item takes precedence) */
  requestContext?: Record<string, unknown>;
  /**
   * Resume data for suspended workflow steps, keyed by step ID.
   * When a workflow suspends during experiment execution, the executor
   * looks up the suspended step's ID here and auto-resumes with the value.
   *
   * @example
   * ```ts
   * { resumeSteps: { "approval-step": { approved: true } } }
   * ```
   */
  resumeSteps?: Record<string, unknown>;
  /**
   * Flat resume data for workflows with a single suspended step.
   * Used as a fallback when `resumeSteps` does not contain an entry
   * for the suspended step ID.
   *
   * @example
   * ```ts
   * { resumeData: { approved: true } }
   * ```
   */
  resumeData?: unknown;
  /**
   * Source trace for tool replay on this item. Takes precedence over the
   * itemId mapping derived from `toolReplay.fromExperimentId`.
   * Storage-backed dataset items can set `metadata.replayTraceId` instead.
   */
  replayTraceId?: string;
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

  /** Scorers — flat array, or the same categorised shape accepted by runEvals */
  scorers?: (MastraScorer<any, any, any, any> | string)[] | AgentScorerConfig | WorkflowScorerConfig;

  // === Options ===

  /** Pin to specific dataset version (default: latest). Only applies when datasetId is used. */
  version?: number;
  /**
   * Run only these item IDs (after version resolution). Lets a caller re-run
   * a single diverging item — e.g. with tool replay — without paying for the
   * whole dataset. Unknown IDs are ignored; matching nothing is an error.
   */
  itemIds?: string[];
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
  /** Global request context passed to agent.generate() for all items */
  requestContext?: Record<string, unknown>;
  /** Agent version ID to record against the experiment */
  agentVersion?: string;
  /** Version overrides for sub-agent delegation during experiment execution */
  versions?: VersionOverrides;
  /**
   * Replay recorded tool outputs from prior traced runs instead of executing
   * live tools. Agent targets only. The source trace for each item resolves
   * from `item.replayTraceId`, then `item.metadata.replayTraceId`, then the
   * itemId → traceId mapping of `fromExperimentId`'s results.
   */
  toolReplay?: {
    /** Prior experiment whose per-item results supply the source traceId for each itemId. */
    fromExperimentId?: string;
    /** Behavior when a tool call has no remaining recorded event (default: 'error'). */
    onMiss?: ToolReplayOnMiss;
    /**
     * How recorded events are matched to the agent's calls (default: 'fifo').
     * 'strict' serves an event only on an exact (canonicalized) args match —
     * anything else is a miss, and argMismatches stays empty by construction.
     */
    matching?: ToolReplayMatching;
  };
  /**
   * Per-tool mocks, by tool name. Agent targets only. Take precedence over
   * replay queues; tools that are neither mocked nor covered by toolReplay
   * execute live. Data mocks stub an output or inject an error; an `expect`
   * asserts how the tool must be called (an unsatisfied expectation fails the
   * item with TOOL_MOCK_EXPECTATION_FAILED). Function mocks replace execute
   * entirely and are code-only (they cannot cross the HTTP API).
   */
  toolMocks?: Record<string, ToolMockConfig>;
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
  /** Tool replay divergence summary (only present when toolReplay was active for the item) */
  toolReplay?: ToolReplayReport;
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
  /**
   * Scope this score targets. Mirrors the canonical `ScorerTargetScope`
   * taxonomy from observability so consumers can differentiate span-level
   * (agent/workflow/step) and trajectory scores in the flat `scores` array.
   * Defaults to 'span' when omitted.
   */
  targetScope?: 'span' | 'trajectory';
  /**
   * ID of the workflow step this score targets. Only set for per-step
   * dispatch (`scorers: { steps: { ... } }`). Step scores keep
   * `targetScope: 'span'` and use `stepId` to identify the step, matching
   * how `runEvals` encodes step identity via `targetEntityType` +
   * `targetMetadata`.
   */
  stepId?: string;
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
