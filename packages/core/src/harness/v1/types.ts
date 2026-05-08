/**
 * Harness v1 — shared types.
 *
 * One file for now. Split when it grows past readability or when a section
 * becomes a class with real methods (e.g. Session).
 *
 * See HARNESS_V1_SPEC.md.
 */

import type { Agent } from '../../agent';
import type { ToolsInput } from '../../agent/types';
import type { HarnessStorage, SessionRecord as StoredSessionRecord } from '../../storage/domains/harness';

// ---------------------------------------------------------------------------
// HarnessMode (§4.2).
//
// Modes are policy overlays on a backing Agent: they pin which agent runs,
// can override or extend its tool surface, and can layer extra instructions
// for the duration of the mode. `transitionsTo` lets `submit_plan` flip
// mode atomically with approval.
// ---------------------------------------------------------------------------

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
   * registered `PendingPlanApproval` freezes this value as
   * `transitionModeId`. On approval, the session flips to this mode
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

// ---------------------------------------------------------------------------
// Placeholders.
//
// These are intentionally empty/loose. Each gets filled in as we work
// through the corresponding section of the spec.
// ---------------------------------------------------------------------------

/**
 * Top-level Harness config (§9). Filled in field by field.
 *
 * Open-ended for now (`[key: string]: unknown`) so we can land fields one at
 * a time without forcing every consumer to update on each addition. Once all
 * fields land, the index signature comes off and this becomes a closed shape.
 */
export interface HarnessConfig {
  /**
   * Agents addressable by id. `HarnessMode.agentId` references resolve
   * against this map. Validated at construction — an unknown id in any
   * mode throws `HarnessConfigError`. May be empty if `modes` is empty.
   *
   * See §9 and §4.2.
   */
  agents: Record<string, Agent>;

  /**
   * Operating modes. Each mode pins a backing agent and may override or
   * extend its tool surface and instructions. Mode ids must be unique;
   * each mode's `agentId` must reference `agents`; each mode's optional
   * `transitionsTo` must reference another mode's `id`. All validated at
   * construction.
   *
   * May be empty (e.g. for harnesses that drive a single agent with no
   * mode policy). When empty, `defaultModeId` must also be omitted, and
   * sessions run against the agent named by their `modeId` resolution
   * elsewhere — see §4.1.
   *
   * See §9 and §4.2.
   */
  modes: HarnessMode[];

  /**
   * Default mode for fresh sessions when no `modeId` override is supplied
   * on `harness.session(...)`. Must reference a `modes[].id`. Required if
   * `modes` is non-empty; must be omitted otherwise.
   *
   * Explicit (rather than implicit `modes[0]`) so that reordering the
   * `modes` array can never silently change runtime behavior.
   */
  defaultModeId?: string;

  /**
   * Session-runtime config (§9 + §5). Currently only carries the storage
   * binding; eviction, lease, and queue knobs land here as we wire them up.
   */
  sessions?: {
    /**
     * Where SessionRecords, leases, and attachment metadata are persisted.
     * Required for any harness that accepts non-`fresh` resolves or that
     * survives process restart — the in-memory adapter is fine for tests
     * and short-lived scripts. Optional only because the field itself
     * lands incrementally.
     */
    storage?: HarnessStorage;
  };

  // Remaining fields (workspace, subagents, skills, goals, files,
  // intervals, observationalMemory) land here as we wire them up.

  [key: string]: unknown;
}

/** Runtime Session class (§4.2). Stubbed when we get to session.ts. */
export interface Session {
  readonly id: string;
  readonly threadId: string;
  readonly resourceId: string;
}

/**
 * Persisted session shape (§5.1). The canonical definition lives in
 * `@mastra/core/storage/domains/harness/types` because adapters need it; the
 * harness layer re-exports it here so consumers can stay on a single import.
 */
export type SessionRecord = StoredSessionRecord;

/** Attachment handle returned by upload (§13.7). */
export interface AttachmentRef {
  attachmentId: string;
  resourceId: string;
}

// ---------------------------------------------------------------------------
// Session resolver options — discriminated union per §5.3.
// ---------------------------------------------------------------------------

interface SessionResolveCommon {
  parentSessionId?: string;
  origin?: 'top-level' | 'subagent-tool';
  modeId?: string;
  modelId?: string;
}

export interface SessionResolveByThread extends SessionResolveCommon {
  threadId: string;
  resourceId: string;
  sessionId?: never;
}

export interface SessionResolveById extends SessionResolveCommon {
  sessionId: string;
  threadId?: never;
  resourceId?: never;
}

export interface SessionResolveByIdScoped extends SessionResolveCommon {
  sessionId: string;
  resourceId: string;
  threadId?: never;
}

export type SessionResolveOptions = SessionResolveByThread | SessionResolveById | SessionResolveByIdScoped;

// ---------------------------------------------------------------------------
// Sub-namespace option shapes for the Harness class.
// ---------------------------------------------------------------------------

export interface ThreadDeleteOptions {
  threadId: string;
  resourceId: string;
}

export interface SessionListOptions {
  resourceId: string;
  includeClosed?: boolean;
}

export interface SessionLoadByIdOptions {
  sessionId: string;
  includeClosed?: boolean;
}

export interface AttachmentUploadOptions {
  resourceId: string;
  data: Buffer | ReadableStream<Uint8Array>;
  filename: string;
  contentType: string;
}

export interface AttachmentDeleteOptions {
  attachmentId: string;
  resourceId: string;
}

export interface ShutdownOptions {
  drainTimeoutMs?: number;
}
