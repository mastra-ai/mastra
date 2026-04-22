import type { MastraScorer } from '../../../evals/base';
import type { TrajectoryExpectation } from '../../../evals/types';
import type { Mastra } from '../../../mastra';
import type { MastraDBMessage } from '../../../memory/types';
import type { ExperimentSummary } from '../types';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Workspace Snapshots
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Describes how to recreate the filesystem state for an experiment item.
 * Any agent that depends on external files/repos can use this.
 */
export type WorkspaceSnapshot =
  | WorkspaceSnapshotGitRef
  | WorkspaceSnapshotDirectory
  | WorkspaceSnapshotTar
  | WorkspaceSnapshotCurrent;

/** Clone a git repository at a specific commit. */
export interface WorkspaceSnapshotGitRef {
  type: 'git-ref';
  /** Path to git repo (local path or remote URL). */
  repo: string;
  /** Commit SHA to check out. */
  commit: string;
  /** Branch name (optional, for faster shallow clone). */
  branch?: string;
  /** Subdirectory within the repo to use as workspace root. */
  subpath?: string;
}

/** Create a workspace from inline file contents. Lightweight for small test cases. */
export interface WorkspaceSnapshotDirectory {
  type: 'directory';
  /** Files to write into the workspace. */
  files: Array<{ path: string; content: string }>;
}

/** Extract a tar/gzip archive into the workspace. */
export interface WorkspaceSnapshotTar {
  type: 'tar';
  /** Path to the archive file. */
  archivePath: string;
}

/**
 * Use an existing directory as-is (no isolation).
 * For local development / quick testing only — not safe for concurrent items.
 */
export interface WorkspaceSnapshotCurrent {
  type: 'current';
  /** Absolute or relative path to use as workspace root. */
  path: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sandbox Experiment Items
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Extended experiment item that includes environment context for complex agents.
 *
 * This is the generic shape — consumers extend it with their agent-specific
 * input/ground-truth/environment types.
 *
 * @typeParam TInput - Shape of the input fed to the agent (e.g., user message)
 * @typeParam TGroundTruth - Shape of expected outcome for scoring
 *
 * @example
 * ```typescript
 * // A coding agent experiment item
 * interface MyCodingItem extends SandboxExperimentItem<
 *   { prompt: string },
 *   { buildPasses: boolean; filesModified: string[] }
 * > {
 *   environment: { mode: 'dev' | 'prod'; modelId: string };
 * }
 * ```
 */
export interface SandboxExperimentItem<
  TInput = unknown,
  TGroundTruth = unknown,
  TEnvironment = Record<string, unknown>,
> {
  /** Unique ID for this item (auto-generated if omitted). */
  id?: string;

  /** Input data passed to the agent during execution. */
  input: TInput;

  /** Expected outcome used by scorers to evaluate results. */
  groundTruth?: TGroundTruth;

  /** Expected trajectory (tool call sequence) for trajectory-based scoring. */
  expectedTrajectory?: TrajectoryExpectation;

  /**
   * How to recreate the filesystem state for this item.
   * If omitted, no workspace setup is performed.
   */
  workspace?: WorkspaceSnapshot;

  /**
   * Agent-specific configuration for this item (mode, model, state, etc.).
   * Consumers define the shape; the lifecycle's `setup` function interprets it.
   */
  environment?: TEnvironment;

  /**
   * Prior conversation and context to inject before execution.
   * Enables faithful replay of sessions that depend on memory.
   */
  memory?: {
    /** Prior conversation messages to seed into the thread. */
    messages?: MastraDBMessage[];
    /** Additional system context (e.g., observational memory observations). */
    systemContext?: string;
  };

  /** Arbitrary metadata (category, difficulty, tags, source trace ID, etc.). */
  metadata?: Record<string, unknown>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sandbox Handle
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Opaque handle returned by `lifecycle.setup()` and passed to `execute()` / `teardown()`.
 *
 * Contains everything the execute function needs to run the agent in context.
 * Consumers extend this with agent-specific data (e.g., Harness instance).
 */
export interface SandboxHandle {
  /** Root directory of the sandbox filesystem (if workspace was created). */
  workspacePath?: string;

  /** Thread ID for memory (if messages were seeded). */
  threadId?: string;

  /** Resource ID for memory scoping. */
  resourceId?: string;

  /** Cleanup function called during teardown. */
  cleanup?: () => Promise<void>;

  /** Agent-specific handle data. */
  [key: string]: unknown;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Lifecycle Hooks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Lifecycle hooks for sandbox experiments.
 *
 * Users implement these to define how their agent's environment is set up,
 * how the agent is executed, and how cleanup happens.
 *
 * @typeParam TItem - The experiment item type (extends SandboxExperimentItem)
 * @typeParam TOutput - What the execute function returns (passed to scorers)
 *
 * @example
 * ```typescript
 * const myLifecycle: SandboxExperimentLifecycle<MyItem, MyOutput> = {
 *   async setup(item, ctx) {
 *     const dir = await createWorkspaceFromSnapshot(item.workspace);
 *     const agent = ctx.mastra.getAgent('my-agent');
 *     return { workspacePath: dir, agent };
 *   },
 *   async execute(item, handle, ctx) {
 *     return await handle.agent.generate(item.input.prompt);
 *   },
 *   async teardown(handle) {
 *     if (handle.workspacePath) await destroyWorkspace(handle.workspacePath);
 *   },
 * };
 * ```
 */
export interface SandboxExperimentLifecycle<TItem extends SandboxExperimentItem, TOutput = unknown> {
  /**
   * Called before each item. Set up workspace, configure agent, inject memory.
   * Return a handle that the execute function will use.
   */
  setup: (item: TItem, ctx: SandboxLifecycleContext) => Promise<SandboxHandle>;

  /**
   * Execute the agent against the item using the sandbox handle from setup.
   * This is where you call `agent.generate()`, `harness.sendMessage()`, etc.
   */
  execute: (item: TItem, handle: SandboxHandle, ctx: SandboxLifecycleContext) => Promise<TOutput>;

  /**
   * Called after each item (success or failure). Clean up workspace, destroy temp dirs.
   * Always called, even if execute threw an error.
   */
  teardown: (handle: SandboxHandle, result: SandboxItemResult<TOutput>) => Promise<void>;
}

/** Context passed to lifecycle hooks. */
export interface SandboxLifecycleContext {
  /** Mastra instance for storage, agent registry, etc. */
  mastra: Mastra;
  /** Experiment ID for correlation/tracing. */
  experimentId?: string;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

/** Result passed to the teardown hook. */
export interface SandboxItemResult<TOutput = unknown> {
  /** Output from execute (undefined if it errored). */
  output?: TOutput;
  /** Error from execute (undefined if it succeeded). */
  error?: Error;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sandbox Experiment Config
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Configuration for `runSandboxExperiment()`.
 *
 * Extends the standard experiment concepts with lifecycle hooks and
 * sandbox-specific options.
 *
 * @typeParam TItem - The experiment item type (extends SandboxExperimentItem)
 * @typeParam TOutput - What the execute function returns (passed to scorers)
 *
 * @example
 * ```typescript
 * const config: SandboxExperimentConfig<MyItem, MyOutput> = {
 *   items: [item1, item2, item3],
 *   lifecycle: myLifecycle,
 *   scorers: [outcomeScorer, efficiencyScorer],
 *   maxConcurrency: 2,
 *   keepSandboxOnFailure: true,
 * };
 * ```
 */
export interface SandboxExperimentConfig<TItem extends SandboxExperimentItem, TOutput = unknown> {
  // === Data source (pick one) ===

  /** Load items from a stored dataset. */
  datasetId?: string;

  /** Inline items (for quick testing or programmatic construction). */
  items?: TItem[];

  // === Lifecycle (required) ===

  /**
   * Lifecycle hooks that define how to set up, execute, and tear down
   * the sandbox for each item. This is the key addition over standard experiments.
   */
  lifecycle: SandboxExperimentLifecycle<TItem, TOutput>;

  // === Execution ===

  /**
   * Maximum concurrent items. Default 2 (sandboxes are expensive).
   * For workspace-heavy experiments, consider 1.
   */
  maxConcurrency?: number;

  /** Per-item timeout in milliseconds. Default: no timeout. */
  timeout?: number;

  /**
   * If true, don't destroy the sandbox when an item fails.
   * Useful for debugging — inspect the workspace after failure.
   */
  keepSandboxOnFailure?: boolean;

  /**
   * Maximum retries per item on failure.
   * Each retry gets a fresh sandbox (new setup/execute/teardown cycle).
   * @default 0
   */
  maxRetries?: number;

  // === Scoring ===

  /** Scorers to evaluate each item's output. */
  scorers?: (MastraScorer<any, any, any, any> | string)[];

  // === Standard experiment fields ===

  /** Experiment name (for display / grouping). */
  name?: string;

  /** Experiment description. */
  description?: string;

  /** Arbitrary metadata. */
  metadata?: Record<string, unknown>;

  /** Agent version ID to record against the experiment. */
  agentVersion?: string;

  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

// Re-export ExperimentSummary for convenience
export type { ExperimentSummary };
