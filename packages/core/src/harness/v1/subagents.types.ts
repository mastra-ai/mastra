// ---------------------------------------------------------------------------
// Subagent registry (v1).
//
// Subagents are short-lived agents spawned by the main session agent through
// the built-in `subagent` tool. Each definition pins a backing agentId, may
// override the agent's tools/instructions/model, and declares which harness
// tools it is allowed to use.
// ---------------------------------------------------------------------------

import type { AgentInstructions, ToolsInput } from '../../agent';
import type { LanguageModel } from '../../llm';
import type { LoopOptions } from '../../loop/types';
import type { DynamicArgument } from '../../types';

export interface SubagentDefinition {
  /** Human-readable name shown in tool output (e.g., "Explore"). */
  name: string;

  /** Description used in the auto-generated tool description. */
  description: string;

  /** Backing agent id. Validated against the harness agent registry. */
  agentId: string;

  /** Tools available to this subagent. Merged with `allowedHarnessTools`. */
  tools?: ToolsInput;

  /**
   * Tool IDs to pull from the harness's shared tool registry. Allows
   * subagents to use a subset of the harness tools.
   */
  allowedHarnessTools?: string[];

  /**
   * Workspace tool keys (after any renames) the model is allowed to call.
   * When set, workspace tools not in this list are hidden via `prepareStep`.
   */
  allowedWorkspaceTools?: string[];

  /** Default instructions layered over the backing agent's own instructions. */
  instructions?: DynamicArgument<AgentInstructions>;

  /** Default model id when the caller does not supply one. */
  defaultModelId?: string;

  /** Maximum number of steps for this subagent's execution loop. */
  maxSteps?: number;

  /** Stop condition for this subagent's execution loop. */
  stopWhen?: LoopOptions['stopWhen'];

  /**
   * When `true`, invocations default to "forked": the parent thread is cloned
   * and the subagent runs on the fork using the parent agent's instructions
   * and tools (preserving prompt-cache prefix). Callers can override per
   * invocation. Forked subagents require memory to be configured.
   */
  forked?: boolean;
}

export interface SubagentRegistryConfig {
  /**
   * Cap on subagent tree depth. A `subagent` tool call from a session at depth
   * equal to or greater than this returns a tool error. Default: `1`.
   */
  maxDepth?: number;

  /** Subagent definitions keyed by type id (the `agentType` enum). */
  types: Record<string, SubagentDefinition>;
}

/** Resolves a model id to a `LanguageModel` for subagent execution. */
export type ModelResolver = (modelId: string) => LanguageModel | Promise<LanguageModel>;
