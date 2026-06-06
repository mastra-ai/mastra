// ---------------------------------------------------------------------------
// Tool composition (v1).
//
// Combines an agent's tool surface with mode overrides, harness built-in
// tools, and permission-rule filtering. The Session/Harness layer never
// imports the legacy `buildToolsets` pipeline — this composer is the v1
// surface for "what tools does this request see?".
// ---------------------------------------------------------------------------

import type { ToolsInput } from '../../agent/types';
import type { PermissionPolicy } from './permissions.types';

export interface PermissionRules {
  /**
   * Per-tool override map. `'allow'` exposes the tool unconditionally,
   * `'deny'` strips it from the toolset, `'ask'` defers to the runtime gate.
   */
  tools?: Record<string, PermissionPolicy>;
}

export interface BuildSessionToolsetsOptions {
  /** Tools declared by the backing agent (already resolved for this request). */
  agentTools?: ToolsInput;
  /** Mode-level overrides. `tools` replaces; `additionalTools` augments. */
  modeOverrides?: { tools?: ToolsInput; additionalTools?: ToolsInput };
  /** Harness built-in tools (ask_user, submit_plan, task_*, subagent, etc). */
  builtInTools?: ToolsInput;
  /** Optional per-tool permission policy. `deny` filters the tool out. */
  permissionRules?: PermissionRules;
  /** Tool ids the caller has explicitly disabled. */
  disabledTools?: readonly string[];
}

/**
 * Produce the final toolset visible to the agent on this request. Pure
 * function — no IO, no side effects.
 *
 * Layering order:
 *  1. Agent tools (or mode `tools` replacement)
 *  2. Mode `additionalTools` (when not in replacement mode)
 *  3. Built-in harness tools (last so they cannot be shadowed)
 *  4. Apply `permissionRules.deny` + `disabledTools` filters
 */
export function buildSessionToolsets(opts: BuildSessionToolsetsOptions = {}): ToolsInput {
  const { agentTools, modeOverrides, builtInTools, permissionRules, disabledTools } = opts;

  const base: Record<string, unknown> = modeOverrides?.tools
    ? { ...(modeOverrides.tools as Record<string, unknown>) }
    : { ...(agentTools as Record<string, unknown> | undefined) };

  if (modeOverrides?.additionalTools && !modeOverrides.tools) {
    Object.assign(base, modeOverrides.additionalTools);
  }

  if (builtInTools) {
    Object.assign(base, builtInTools);
  }

  const denySet = new Set<string>(disabledTools ?? []);
  for (const [name, policy] of Object.entries(permissionRules?.tools ?? {})) {
    if (policy === 'deny') denySet.add(name);
  }

  for (const name of denySet) {
    delete base[name];
  }

  return base as ToolsInput;
}
