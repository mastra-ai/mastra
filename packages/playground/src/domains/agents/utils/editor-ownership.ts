import type { AgentEditorConfig } from '@mastra/core/agent';

export interface EditorOwnership {
  /** User owns the instructions field (Studio edits are persisted). */
  ownsInstructions: boolean;
  /** User owns tool membership (add/remove) and tool descriptions. */
  ownsTools: boolean;
  /** User owns tool descriptions (implied by ownsTools). */
  ownsToolDescriptions: boolean;
  /** Instructions are owned by code and must render read-only. */
  isInstructionsLocked: boolean;
  /** Tools are owned by code and must render read-only. */
  isToolsLocked: boolean;
  /** Tool descriptions are editable but tool membership is not. */
  toolDescriptionsOnly: boolean;
  /** Nothing is editable — the whole editor is read-only. */
  isFullyLocked: boolean;
}

/**
 * Derives which agent fields the user owns (vs. which are owned by code).
 *
 * These flags MUST mirror the server's getCodeAgentOwnership
 * (packages/server/src/server/handlers/stored-agents.ts): on save the server strips any field a code
 * agent doesn't own. If the client and server disagree, Studio either sends data the server silently
 * drops (looks saved, reloads blank) or hides edits the server would keep.
 *
 * Server semantics for instructions:
 *   editor === false             → not owned (locked)
 *   editor unset (undefined)     → owned — legacy default: an editor-unset code agent is fully editable
 *   editor === true              → not owned (a bare boolean is not an object, so `.instructions` is unset)
 *   editor.instructions === true → owned
 * Server semantics for tools mirror this:
 *   editor unset (undefined)               → owned (membership + descriptions)
 *   editor.tools === true                  → owned (membership + descriptions)
 *   editor.tools === { description: true } → owns tool descriptions only
 *
 * The `undefined` case was the source of a previous bug (for both instructions and tools): `=== true`-only
 * checks made an editor-unset code agent send an empty instructions array and drop tool edits on save,
 * wiping changes the server would have kept.
 */
export function getEditorOwnership(
  isCodeAgentOverride: boolean | undefined,
  editorConfig: AgentEditorConfig | undefined,
): EditorOwnership {
  const isOverride = !!isCodeAgentOverride;
  const config = editorConfig;
  // Stryker disable next-line ConditionalExpression,BooleanLiteral: defensive redundancy.
  // When `config` is `false`, `config?.tools` already reads as `undefined`, and both
  // `undefined` and `false` fail every check below — no input can tell them apart.
  const toolsConfig = config === false ? false : config?.tools;

  // Stryker disable next-line ConditionalExpression,BooleanLiteral: defensive redundancy.
  // `config !== false` only restates the following check: a boolean `config` has no
  // `.instructions`, so the comparison is already false without the guard.
  const ownsInstructions = !isOverride || config === undefined || (config !== false && config?.instructions === true);
  const ownsTools = !isOverride || config === undefined || toolsConfig === true;
  const ownsToolDescriptions =
    !isOverride ||
    config === undefined ||
    toolsConfig === true ||
    (typeof toolsConfig === 'object' && toolsConfig.description === true);

  return {
    ownsInstructions,
    ownsTools,
    ownsToolDescriptions,
    isInstructionsLocked: !ownsInstructions,
    isToolsLocked: !ownsTools && !ownsToolDescriptions,
    toolDescriptionsOnly: !ownsTools && ownsToolDescriptions,
    isFullyLocked: !ownsInstructions && !ownsTools && !ownsToolDescriptions,
  };
}
