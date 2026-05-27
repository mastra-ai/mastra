// ---------------------------------------------------------------------------
// HarnessMode (§4.2).
//
// Modes are policy overlays on a backing Agent: they pin which agent runs,
// can override or extend its tool surface, and can layer extra instructions
// for the duration of the mode. `transitionsTo` lets `submit_plan` flip
// mode atomically with approval.
// ---------------------------------------------------------------------------

import type { ToolsInput } from '../../agent';

export interface HarnessMode {
  /** Unique within `HarnessConfig.modes`. Validated at construction. */
  id: string;

  /**
   * Backing agent. Must reference a key in `HarnessConfig.agents`.
   * Validated at construction — unknown id throws `HarnessConfigError`.
   */
  agentId: string;

  /** Surfaced in mode pickers / Studio UI. Free text. */
  description?: string;

  /**
   * Layered above the backing agent's own instructions for the duration
   * of this mode. Plain text by design — modes carve operating profile,
   * not full system-message overrides.
   */
  instructions?: string;

  /**
   * The tool set this mode runs with. **Replaces** the backing agent's
   * tools — the agent's own tools are hidden for the duration of the
   * mode. Mutually exclusive with `additionalTools` (validated at
   * construction).
   */
  tools?: ToolsInput;

  /**
   * Tools layered on top of the backing agent's tools. The agent's tools
   * stay; these are added. Mutually exclusive with `tools`.
   */
  additionalTools?: ToolsInput;

  /**
   * Optional plan→build target. When `submit_plan` runs in this mode, the
   * registered `PendingResume` freezes this value as `transitionModeId`.
   * On approval, the session flips to this mode
   * idempotently (§5.1, §5.7). If unset, plan approval resumes with no
   * mode change. Must reference another mode's `id`.
   */
  transitionsTo?: string;

  /**
   * Arbitrary user-defined metadata. Pass-through only — the harness
   * never reads or validates it. Use for UI affordances like display
   * color, icon, display name overrides, or any per-mode configuration
   * that isn't part of the harness's own contract.
   *
   * Surfaced verbatim on `getCurrentMode()` and `listModes()`.
   */
  metadata?: Record<string, unknown>;
}
