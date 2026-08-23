import type { AgentScorerConfig, WorkflowScorerConfig } from '../../evals';
import type { MastraScorer, ScorerStepName } from '../../evals/base';
import type { TrajectoryExpectation } from '../../evals/types';
import type { Mastra } from '../../mastra';
import type { VersionOverrides } from '../../mastra/types';
import type {
  DatasetTenancyFilters,
  ExperimentGrouping,
  ExperimentProvenance,
  ExperimentStatus,
  TargetType,
} from '../../storage/types';
import type { ExperimentEventObserver } from './events';
import type { ItemToolMock, ToolMockReport, UnmockedToolPolicy } from './tool-mocks';

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
  /** Expected trajectory forwarded to trajectory scorers as `run.expectedTrajectory` */
  expectedTrajectory?: TrajectoryExpectation;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Per-item request context merged over the global request context (item takes precedence) */
  requestContext?: Record<string, unknown>;
  /**
   * Scorer IDs that override dataset-attached scorers for this item when run-level
   * `config.scorers` is absent. Run-level scorers, including an empty configuration,
   * take precedence. An empty array explicitly disables scoring for the item.
   */
  scorerIds?: string[];
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
   * Item-level static tool mocks (agent targets only).
   * When provided, the agent serves the mocked output in place of executing the
   * real tool; calling a mocked tool with non-matching args fails the item.
   */
  toolMocks?: ItemToolMock[];
  /** Overrides the experiment's handling of tool calls not declared in `toolMocks`. */
  unmockedToolPolicy?: UnmockedToolPolicy;
}

/**
 * The subset of a dataset item exposed to experiment lifecycle hooks.
 * Mirrors the fields a hook can meaningfully act on without letting hooks
 * mutate execution-control fields (tool mocks, resume data, scorer selection).
 */
export interface ExperimentHookItem<I = unknown, E = unknown> {
  /** ID of the dataset item */
  id: string;
  /** Input data that will be passed to the target */
  input: I;
  /** Ground truth for scoring, when the item declares one */
  groundTruth?: E;
  /** Item metadata */
  metadata?: Record<string, unknown>;
}

/** Arguments passed to run-level and item-level experiment hooks. */
export interface ExperimentHookArgs {
  /** ID of the experiment being run */
  experimentId: string;
  /** The Mastra instance the experiment is running against */
  mastra: Mastra;
  /** Run-level abort signal, when the run is cancellable */
  signal?: AbortSignal;
}

/** Arguments passed to `beforeEach`. */
export interface ExperimentItemHookArgs<I = unknown, E = unknown> extends ExperimentHookArgs {
  /** The item about to be executed */
  item: ExperimentHookItem<I, E>;
}

/** Arguments passed to `afterEach`. */
export interface ExperimentItemResultHookArgs<I = unknown, E = unknown> extends ExperimentItemHookArgs<I, E> {
  /** The completed item result, including scores */
  result: ItemWithScores;
}

/** Arguments passed to `afterAll`. */
export interface ExperimentRunResultHookArgs extends ExperimentHookArgs {
  /** The summary that is about to be returned from `runExperiment` */
  summary: ExperimentSummary;
}

/**
 * Per-domain persistence selection for a single experiment run.
 *
 * - `default` — write through the `Mastra` instance's configured storage (current behavior).
 * - `none` — perform no writes for that domain for this run. Execution, scoring, and the
 *   returned {@link ExperimentSummary} are unaffected; only the storage writes are skipped.
 *
 * The two domains are independent: selecting `none` for one does not change the other.
 *
 * This policy governs *experiment bookkeeping* only. It does not disable unrelated
 * application storage the target itself may use — agent memory, vectors, working memory,
 * observability traces, or arbitrary code the target runs. It is not a sandbox.
 */
export interface ExperimentPersistencePolicy {
  /**
   * Experiment records, progress updates, and per-item results
   * (`mastra_experiments` / `mastra_experiment_results`). Default: `default`.
   */
  experiments?: 'default' | 'none';
  /** Scores emitted by experiment scorers. Default: `default`. */
  scores?: 'default' | 'none';
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

  // === Lifecycle hooks ===

  /**
   * Runs once before any item executes — use it to seed fixtures the target
   * depends on (files, database rows, sandbox state).
   *
   * A throw or rejection aborts the run before any item executes: the
   * experiment finishes with status `failed`, every item counted as skipped.
   *
   * @example
   * ```ts
   * await runExperiment(mastra, {
   *   data: items,
   *   targetType: 'agent',
   *   targetId: 'my-agent',
   *   beforeAll: async () => { await seedWorkspace(); },
   *   afterAll: async () => { await clearWorkspace(); },
   * });
   * ```
   */
  beforeAll?: (args: ExperimentHookArgs) => void | Promise<void>;
  /**
   * Runs once after every item has settled, immediately before `runExperiment`
   * returns — including when the run failed or was cancelled. Receives the
   * summary that is about to be returned.
   *
   * Errors are logged and swallowed so teardown cannot mask the run outcome.
   */
  afterAll?: (args: ExperimentRunResultHookArgs) => void | Promise<void>;
  /**
   * Runs before each item executes, inside the item's concurrency slot, so it
   * respects `maxConcurrency`. Runs once per item, not once per retry attempt.
   *
   * A throw or rejection fails that item without executing the target and
   * without retrying; the error is recorded on the item result. Other items
   * are unaffected. `afterEach` is skipped for the item, on the assumption
   * that a failed setup owns its own cleanup.
   */
  beforeEach?: (args: ExperimentItemHookArgs<I, E>) => void | Promise<void>;
  /**
   * Runs after each item completes (including failed items), once its result
   * and scores are final. Use it to tear down whatever `beforeEach` set up.
   *
   * Errors are logged and swallowed so teardown cannot change an item's
   * recorded outcome.
   */
  afterEach?: (args: ExperimentItemResultHookArgs<I, E>) => void | Promise<void>;

  /** Pin to specific dataset version (default: latest). Only applies when datasetId is used. */
  version?: number;
  /** Maximum concurrent executions (default: 5) */
  maxConcurrency?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /**
   * Awaited observer for versioned, JSON-safe semantic lifecycle events.
   * Delivery is serialized and applies run-wide backpressure. A rejected
   * observer aborts the run and rejects `runExperiment` with a typed error.
   * The terminal event is delivered before terminal status is persisted, so
   * consumers must not treat it as a read-after-write signal for storage.
   */
  onEvent?: ExperimentEventObserver;
  /** Per-item execution timeout in milliseconds */
  itemTimeout?: number;
  /** Maximum retries per item on failure (default: 0 = no retries). Abort errors are never retried. */
  maxRetries?: number;
  /**
   * Per-run, per-domain persistence policy. Omitted or partially specified fields
   * default to `default`, so omitting this preserves existing behavior exactly.
   *
   * Selecting `none` lets a caller own persistence itself — for example a run
   * executing inside a sandbox whose results are recorded by the host rather than
   * through the bundled `Mastra` instance's storage.
   *
   * @example
   * ```ts
   * await runExperiment(mastra, {
   *   data: items,
   *   targetType: 'agent',
   *   targetId: 'my-agent',
   *   persistence: { experiments: 'none', scores: 'none' },
   * });
   * ```
   */
  persistence?: ExperimentPersistencePolicy;
  /** Default handling for agent tool calls not declared in an item's `toolMocks` (default: `allow`). */
  unmockedToolPolicy?: UnmockedToolPolicy;
  /** Pre-created experiment ID (for async trigger — skips experiment creation). */
  experimentId?: string;
  /** Experiment name (used for display / grouping) */
  name?: string;
  /** Experiment description */
  description?: string;
  /** Arbitrary display metadata for the experiment */
  metadata?: Record<string, unknown>;
  /** Caller-provided source identity for traceability. */
  provenance?: ExperimentProvenance;
  /** Stable dimensions for grouping related experiment executions. */
  grouping?: ExperimentGrouping;
  /** Global request context passed to agent.generate() for all items */
  requestContext?: Record<string, unknown>;
  /** Agent version ID to record against the experiment */
  agentVersion?: string;
  /** Version overrides for sub-agent delegation during experiment execution */
  versions?: VersionOverrides;
  /**
   * Tenancy read-scope for the parent dataset. When set, the storage-backed
   * dataset load is scoped to this tenant — a cross-tenant `datasetId` fails
   * NOT_FOUND rather than leaking the dataset contents. Ignored for the inline
   * `data` path (no dataset lookup happens). Not exposed on
   * {@link StartExperimentConfig}; injected by the {@link Dataset} handle.
   */
  filters?: DatasetTenancyFilters;
}

/**
 * Configuration for starting an experiment on a dataset.
 * The dataset is always the data source — no datasetId/data needed.
 */
export type StartExperimentConfig<I = unknown, O = unknown, E = unknown> = Omit<
  ExperimentConfig<I, O, E>,
  'datasetId' | 'data' | 'experimentId' | 'filters'
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
  /**
   * Structured error if persisting this result to storage failed.
   * Present and non-null means the target run outcome (success or failure)
   * is reflected on this in-memory item but the row was never written to
   * `mastra_experiment_results`. Callers can use this to detect silent data
   * loss and decide whether to retry or alert. Absent or null on the happy
   * path; optional so external mocks / wrappers don't need to hand-construct it.
   *
   * Only the error `message` is exposed here — the raw stack is logged
   * internally via the Mastra logger and intentionally omitted from the
   * returned object to avoid leaking internal file paths across trust
   * boundaries.
   */
  persistenceError?: { message: string } | null;
  /** Diagnostic receipt for item-level tool mocks (agent targets only) */
  toolMockReport?: ToolMockReport;
}

/**
 * Result from a single scorer for an item.
 */
export interface ScorerResult {
  /** ID of the scorer */
  scorerId: string;
  /** Display name of the scorer */
  scorerName: string;
  /** Computed score, or null when no score was produced */
  score: number | null;
  /** Reason/explanation for the score, or null when no reason was produced */
  reason: string | null;
  /** Error message if scorer failed */
  error: string | null;
  /** Scorer stage that failed, when the scorer exposes stage context */
  failedStep?: ScorerStepName;
  /** Scorer stages that completed before the failure */
  completedSteps?: ScorerStepName[];
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
  /**
   * Number of item results whose target run completed but which failed to
   * persist to `mastra_experiment_results`. These items are still counted in
   * `succeededCount` / `failedCount` because those reflect target-run
   * outcomes, but their rows are missing from storage. Non-zero means the
   * DB is out of sync with the returned summary — inspect each item's
   * `persistenceError` to see which ones dropped. Optional so external
   * mocks / wrappers don't need to hand-construct it; the runner always sets it.
   */
  persistenceFailures?: number;
  /** True if run completed but some items failed */
  completedWithErrors: boolean;
  /** When the experiment started */
  startedAt: Date;
  /** When the experiment completed */
  completedAt: Date;
  /** All item results with their scores */
  results: ItemWithScores[];
}
