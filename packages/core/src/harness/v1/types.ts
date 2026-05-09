/**
 * Harness v1 — shared types.
 *
 * One file for now. Split when it grows past readability or when a section
 * becomes a class with real methods (e.g. Session).
 *
 * See HARNESS_V1_SPEC.md.
 */

import type { z } from 'zod';

import type { Agent } from '../../agent';
import type { AgentExecutionOptionsBase } from '../../agent/agent.types';
import type { ToolsInput } from '../../agent/types';
import type { Mastra } from '../../mastra';
import type { MastraCompositeStore } from '../../storage/base';
import type { HarnessStorage, SessionRecord as StoredSessionRecord } from '../../storage/domains/harness';
import type { MastraModelOutput, FullOutput } from '../../stream/base/output';

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
/**
 * Top-level Harness config (§9).
 *
 * Two shapes are supported:
 *
 *   1. **Registered on a Mastra instance.** The Harness is created with no
 *      `mastra` / `agents` / `storage` of its own and is then registered as
 *      a child of a `Mastra` instance (`new Mastra({ harnesses: { ... } })`).
 *      The parent calls `harness.__registerMastra(mastra)` and the harness
 *      reads agents and storage from there.
 *
 *   2. **Self-contained.** The Harness is constructed with `agents` (and
 *      optionally `storage`) and internally builds a private `Mastra`
 *      instance. This is the path scripts and tests take so the harness
 *      stays usable without setting up a full Mastra app.
 *
 * Either way, the runtime invariant after construction (and registration,
 * if applicable) is the same: `harness.mastra` is always a `Mastra`, and
 * agents / storage flow through it.
 *
 * `mastra`, `agents`, and `storage` are mutually exclusive at the top
 * level — passing both `mastra` and `agents`/`storage` throws
 * `HarnessConfigError` at construction.
 */
export type HarnessConfig = HarnessConfigCommon &
  (
    | {
        /**
         * Pre-built Mastra instance to drive this harness. Mutually
         * exclusive with top-level `agents` / `storage`.
         *
         * If you want to register the harness on a Mastra (so it lives in
         * `mastra.harnesses.*`), omit this field and pass the harness to
         * `new Mastra({ harnesses })` instead — the parent will install
         * itself onto the harness automatically.
         */
        mastra: Mastra;
        agents?: never;
        storage?: never;
      }
    | {
        mastra?: never;
        /**
         * Agents addressable by id. `HarnessMode.agentId` references resolve
         * against the keys of this map. Validated at construction — an
         * unknown id in any mode throws `HarnessConfigError`. May be omitted
         * when the harness will be registered onto an existing Mastra.
         */
        agents?: Record<string, Agent>;

        /**
         * Storage backing the internal Mastra. Optional — the in-memory
         * default is fine for tests and short-lived scripts. Required for
         * any harness that survives process restart.
         */
        storage?: MastraCompositeStore;
      }
  );

export interface HarnessConfigCommon {
  /**
   * Operating modes. Each mode pins a backing agent and may override or
   * extend its tool surface and instructions. Mode ids must be unique;
   * each mode's `agentId` must reference an agent visible to the harness
   * (either through the parent Mastra or the inline `agents` map); each
   * mode's optional `transitionsTo` must reference another mode's `id`.
   * All validated at construction (or, for the registered-on-Mastra
   * shape, at registration time).
   *
   * May be empty (e.g. for harnesses that drive a single agent with no
   * mode policy). When empty, `defaultModeId` must also be omitted.
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
   * binding override; eviction, lease, and queue knobs land here as we
   * wire them up.
   */
  sessions?: {
    /**
     * Override for where SessionRecords, leases, and attachment metadata
     * are persisted. Defaults to the harness domain on the Mastra
     * instance's storage (`mastra.getStorage().stores.harness`). Pass
     * a custom adapter only if the harness needs to persist into a
     * different store than the rest of the Mastra app.
     */
    storage?: HarnessStorage;
  };

  // Remaining fields (workspace, subagents, skills, goals, files,
  // intervals, observationalMemory) land here as we wire them up.

  [key: string]: unknown;
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
  /**
   * Existing thread id, or `{ fresh: true }` to force a brand-new thread.
   * `{ fresh: true }` also flips `SessionRecord.ownsThread` to `true` so the
   * thread is deleted on cascade (§5.5).
   */
  threadId: string | { fresh: true };
  resourceId: string;
  sessionId?: string;
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

/**
 * Resource-only resolution: hydrate the most-recent active session for
 * `resourceId`, or create a fresh thread + session if none exists. Useful
 * for single-user CLIs that just want "give me a session for this user".
 */
export interface SessionResolveByResource extends SessionResolveCommon {
  resourceId: string;
  threadId?: never;
  sessionId?: never;
}

export type SessionResolveOptions =
  | SessionResolveByThread
  | SessionResolveById
  | SessionResolveByIdScoped
  | SessionResolveByResource;

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

// ---------------------------------------------------------------------------
// Session.message() — §4.2.
//
// `message()` is the always-accept signal-driven entry point. The shape of
// the call decides what comes back:
//
//   * default                          → AgentResult bundle (await everything)
//   * { stream: true }                 → live MastraModelOutput
//   * { output: schema, sync: true }   → fail-fast structured object
//
// `stream: true` and `output` are mutually exclusive. `sync: true` is only
// valid alongside `output` (it's the fail-fast typed path; spec §4.2).
// Per-turn overrides (model, mode, additionalTools) are intentionally a
// narrow subset of `HarnessOverrides`; richer override surfaces land with
// `queue()` and goal loops.
// ---------------------------------------------------------------------------

/** Per-turn overrides allowed on `message()`. Spec §4.2 / §9 (HarnessOverrides). */
export interface MessageOverrides {
  /** Override the model id for just this turn. Falls back to session model. */
  model?: string;
  /** Override the active mode for this turn. Must reference a known mode id. */
  mode?: string;
  /**
   * Tools layered on top of the session's effective tool surface for this
   * turn. Merge-only — the session's own tools stay. Mirrors
   * `HarnessMode.additionalTools` semantics.
   */
  additionalTools?: ToolsInput;
}

/**
 * Common fields shared by every `message()` call.
 */
interface MessageOptionsBase extends MessageOverrides {
  /** Free-form user content. The only required field. */
  content: string;

  /** Optional pre-uploaded attachments to include with the user message. */
  attachments?: AttachmentRef[];

  /**
   * Forwarded to the underlying agent run. Lets callers cancel from outside
   * without invoking `session.abort()`. Combined internally with the
   * harness's own abort plumbing.
   */
  abortSignal?: AbortSignal;
}

/** Default shape: returns a fully-resolved `AgentResult`. */
export interface MessageOptionsDefault extends MessageOptionsBase {
  stream?: false;
  output?: undefined;
  sync?: undefined;
}

/** Streaming shape: caller wants the live `MastraModelOutput`. */
export interface MessageOptionsStream extends MessageOptionsBase {
  stream: true;
  output?: undefined;
  sync?: undefined;
}

/**
 * Structured-output shape: returns a parsed object matching `output`.
 * `sync: true` is required — typed output needs a clean turn boundary, so
 * this path is fail-fast on a busy session (spec §4.2). Any Standard-Schema
 * value is accepted; we type against zod here for ergonomics in tests.
 */
export interface MessageOptionsStructured<S extends z.ZodTypeAny> extends MessageOptionsBase {
  output: S;
  sync: true;
  stream?: false;
}

export type MessageOptions<S extends z.ZodTypeAny = z.ZodTypeAny> =
  | MessageOptionsDefault
  | MessageOptionsStream
  | MessageOptionsStructured<S>;

/**
 * Result returned by `message()` in its default (non-streaming, non-typed)
 * form. Currently a thin alias for the agent runtime's `FullOutput`. We
 * keep it as a named export so the harness can layer harness-only fields
 * (e.g., signalId, queuedItemId, harness-managed warnings) here later
 * without breaking callers.
 */
export type AgentResult<OUTPUT = undefined> = FullOutput<OUTPUT>;

/** Shorthand for the streaming return type. */
export type AgentStream<OUTPUT = undefined> = MastraModelOutput<OUTPUT>;

/**
 * Pass-through of the agent's own execution options for the rare case a
 * caller needs to drop down to the raw surface. Most callers should stay on
 * `MessageOptions`.
 */
export type RawAgentExecutionOptions<OUTPUT = unknown> = AgentExecutionOptionsBase<OUTPUT>;
