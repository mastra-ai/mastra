/**
 * MastraCode Experiment Types
 *
 * Extends the generic SandboxExperimentItem with MastraCode-specific
 * input/output/environment types for faithful session replay.
 */

import type { MastraDBMessage } from '@mastra/core/agent';
import type { TrajectoryExpectation } from '@mastra/core/evals';
import type { SandboxExperimentItem, WorkspaceSnapshot } from '@mastra/core/datasets';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Input types (what we feed to the agent)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** The user's input to the agent. */
export interface MastraCodeInput {
  /** The user's text message. */
  userMessage: string;
  /** Optional file attachments. */
  files?: Array<{ data: string; mediaType: string; filename: string }>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Ground truth (what we expect the agent to achieve)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Expected outcome for scoring against. */
export interface MastraCodeGroundTruth {
  // === Hard assertions (code-based scoring) ===

  /** Whether the final build/typecheck should pass. */
  buildPasses?: boolean;
  /** Whether the final test run should pass. */
  testsPasses?: boolean;
  /** Files that should be modified (relative paths). */
  filesModified?: string[];
  /** Files that should be created (relative paths). */
  filesCreated?: string[];
  /** Files that should be deleted (relative paths). */
  filesDeleted?: string[];
  /** Tools that should appear in the session. */
  toolsUsed?: string[];
  /** Tools that should NOT appear (blacklist). */
  toolsNotUsed?: string[];

  // === Soft bounds (efficiency scoring) ===

  /** Maximum assistant turns to complete the task. */
  maxTurns?: number;
  /** Maximum total tool calls. */
  maxToolCalls?: number;
  /** Maximum total duration in ms. */
  maxDurationMs?: number;

  // === Custom assertions ===

  /**
   * Custom checks run against the workspace after execution.
   * Each check is evaluated by the offline outcome-match scorer.
   */
  customAssertions?: CustomAssertion[];
}

export type CustomAssertion =
  | { check: 'file-contains'; path: string; content: string }
  | { check: 'file-exists'; path: string }
  | { check: 'file-not-exists'; path: string }
  | { check: 'command-succeeds'; command: string; cwd?: string };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Environment (agent configuration for this item)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Agent configuration/environment for faithful replay. */
export interface MastraCodeEnvironment extends Record<string, unknown> {
  /** Agent mode (determines instructions + tool availability). */
  mode: 'build' | 'plan' | 'fast';

  /** Model ID to use (e.g., 'anthropic/claude-opus-4-6'). */
  modelId: string;

  /**
   * Harness state snapshot — captures the relevant configuration
   * that influences agent behavior beyond mode and model.
   */
  harnessState: MastraCodeHarnessState;
}

/**
 * Subset of harness state relevant to experiment replay.
 * Not all state fields matter for reproducibility — we capture the ones
 * that influence agent behavior.
 */
export interface MastraCodeHarnessState {
  /** Project root path (within the sandbox). */
  projectPath: string;
  /** Project name. */
  projectName: string;
  /** Git branch name at time of capture. */
  gitBranch?: string;
  /** Platform (darwin, linux, etc.). */
  platform?: string;
  /** YOLO mode (auto-approve tool calls). */
  yolo?: boolean;
  /** Permission rules for tool approval. */
  permissionRules?: {
    categories: Record<string, 'allow' | 'ask' | 'deny'>;
    tools: Record<string, 'allow' | 'ask' | 'deny'>;
  };
  /** Thinking level for model reasoning. */
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high' | 'xhigh';
  /** Smart editing mode. */
  smartEditing?: boolean;
  /** OM scope (thread or resource). */
  omScope?: 'thread' | 'resource';
  /** Active plan (if in build mode executing an approved plan). */
  activePlan?: { title: string; plan: string; approvedAt: string } | null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Memory context (what the agent "remembers")
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Memory context to inject before execution. */
export interface MastraCodeMemory {
  /** Prior conversation messages (thread history). */
  messages?: MastraDBMessage[];
  /**
   * Observational memory text (compressed observations).
   * Injected as system context if provided.
   */
  observationalMemory?: string;
  /** AGENTS.md content that was injected at time of capture. */
  agentsMd?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Full experiment item
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * A complete MastraCode experiment item.
 *
 * Extends the generic SandboxExperimentItem with MastraCode-specific types
 * for input, ground truth, environment, and memory.
 *
 * @example
 * ```typescript
 * const item: MastraCodeExperimentItem = {
 *   input: { userMessage: 'Fix the TypeScript error in utils.ts' },
 *   environment: {
 *     mode: 'build',
 *     modelId: 'anthropic/claude-opus-4-6',
 *     harnessState: { projectPath: '.', projectName: 'my-app', yolo: true },
 *   },
 *   workspace: { type: 'git-ref', repo: '.', commit: 'abc123' },
 *   expectedOutcome: { buildPasses: true, filesModified: ['src/utils.ts'] },
 *   metadata: { category: 'build-fix', difficulty: 'easy' },
 * };
 * ```
 */
export interface MastraCodeExperimentItem extends SandboxExperimentItem<MastraCodeInput, MastraCodeGroundTruth, MastraCodeEnvironment> {
  /** Agent configuration for this item (required for MastraCode). */
  environment: MastraCodeEnvironment;

  /** Memory context to inject (overrides generic `memory` field). */
  memory?: MastraCodeMemory;

  /** Workspace snapshot (inherited from SandboxExperimentItem). */
  workspace?: WorkspaceSnapshot;

  /** Expected trajectory for trajectory-based scoring. */
  expectedTrajectory?: TrajectoryExpectation;

  /** Item metadata. */
  metadata?: MastraCodeItemMetadata;
}

/** Metadata for a MastraCode experiment item. */
export interface MastraCodeItemMetadata extends Record<string, unknown> {
  /** Trace ID this item was derived from. */
  sourceTraceId?: string;
  /** Feedback on the original trace. */
  sourceFeedback?: 'positive' | 'negative';
  /** Task category for grouping/filtering. */
  category?: string;
  /** Difficulty level. */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** Human-readable description of what this tests. */
  description?: string;
  /** Tags for filtering. */
  tags?: string[];
  /** When this item was recorded. */
  dateRecorded?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Runner config (MastraCode-specific experiment options)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Configuration for running a MastraCode experiment. */
export interface MastraCodeExperimentConfig {
  /** Dataset ID to run against. */
  datasetId?: string;
  /** Inline items (for quick testing). */
  items?: MastraCodeExperimentItem[];

  // === Overrides for A/B testing ===

  /** Override model for all items (compare different models). */
  modelOverride?: string;
  /** Override mode for all items (compare different modes). */
  modeOverride?: 'build' | 'plan' | 'fast';

  // === Execution ===

  /** Maximum concurrent items. Default 2. */
  maxConcurrency?: number;
  /** Per-item timeout in ms. Default 5 minutes. */
  timeout?: number;
  /** Whether to inject captured memory before execution. Default true. */
  replayMemory?: boolean;
  /** Keep sandbox on failure for debugging. */
  keepSandboxOnFailure?: boolean;

  // === Scoring ===

  /** Include the default offline scorers (outcome-match, trajectory-efficiency). */
  includeDefaultScorers?: boolean;
  /** Include the LLM judge scorer (expensive). */
  includeLlmJudge?: boolean;
  /** Additional custom scorers. */
  scorers?: unknown[];

  // === Experiment metadata ===

  /** Experiment name. */
  name?: string;
  /** Experiment description. */
  description?: string;
  /** Agent version string. */
  agentVersion?: string;
}
