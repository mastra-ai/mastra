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
import type { RequestContext } from '../../request-context';
import type { MastraCompositeStore } from '../../storage/base';
import type { HarnessStorage, SessionRecord as StoredSessionRecord } from '../../storage/domains/harness';
import type { MastraModelOutput, FullOutput } from '../../stream/base/output';
import type { Workspace } from '../../workspace';
import type { WorkspaceProvider, WorkspaceProviderContext } from './workspace-provider';

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

    /**
     * Maximum number of items allowed to wait in `pendingQueue` per session.
     * `session.queue(...)` rejects with `HarnessQueueFullError` when full.
     * Capacity check + durable append are atomic per session. Defaults to 100.
     */
    maxQueueDepth?: number;
  };

  /**
   * Subagent type registry (§9). When `types` is non-empty, the harness
   * registers a built-in `spawn_subagent` tool on every session. The tool's
   * `agentType` enum is drawn from the keys of this map.
   *
   * Validated at construction (or registration): each entry's `agentId`
   * must reference an agent visible to the harness, and each entry's
   * optional `modeId` must reference a mode in `modes`. Unknown ids throw
   * `HarnessConfigError`.
   *
   * `maxDepth` caps the subagent tree depth. A `spawn_subagent` call from
   * a session at depth equal to or greater than `maxDepth` returns a tool
   * error containing `HarnessSubagentDepthExceededError`. Default: `1`
   * (the top-level session can spawn one level of subagents).
   */
  subagents?: {
    maxDepth?: number;
    types: Record<string, SubagentDefinition>;
  };

  /**
   * Goal-loop defaults (§4.7). When a session calls `setGoal({ objective })`
   * without an explicit judge model or budget, these defaults are used.
   *
   * `defaultJudgeModel` falls back to the session's current model id when
   * unset. `defaultMaxTurns` defaults to 50.
   */
  goals?: {
    defaultJudgeModel?: string;
    defaultMaxTurns?: number;
  };

  /**
   * Workspace configuration (§2.7). Selects one of three ownership models —
   * `shared` (one workspace for the whole harness), `per-resource` (one per
   * `resourceId`, refcounted across that user's sessions), or `per-session`
   * (one per session, persisted in `SessionRecord.workspace`).
   *
   * `shared` accepts either a pre-built `Workspace` or a factory matching the
   * legacy harness signature `({ requestContext }) => Workspace`. `per-resource`
   * accepts the factory shorthand or a full `WorkspaceProvider`. `per-session`
   * requires the full `WorkspaceProvider` shape with `resumable: true` —
   * factory shorthands resolve to non-resumable providers and are rejected
   * at startup with `HarnessConfigError`.
   *
   * Provisioning is lazy by default; pass `eager: true` to provision on
   * `init()` / session create.
   */
  workspace?: HarnessWorkspaceConfig;

  // Remaining fields (skills, files, intervals, observationalMemory) land here
  // as we wire them up.

  [key: string]: unknown;
}

/**
 * Discriminated union of workspace configurations (§2.7).
 *
 * - `shared`: one workspace for every session.
 * - `per-resource`: one workspace per resource, refcounted.
 * - `per-session`: one workspace per session, persisted across restarts.
 */
export type HarnessWorkspaceConfig =
  | {
      kind: 'shared';
      workspace: Workspace | ((ctx: { requestContext: RequestContext }) => Workspace | Promise<Workspace>);
      eager?: boolean;
    }
  | {
      kind: 'per-resource';
      provider: WorkspaceProvider | ((ctx: WorkspaceProviderContext) => Workspace | Promise<Workspace>);
      eager?: boolean;
    }
  | {
      kind: 'per-session';
      provider: WorkspaceProvider;
      eager?: boolean;
    };

/**
 * Subagent definition (§9). Declares one entry in
 * `HarnessConfig.subagents.types`. Each entry pins a backing agent and
 * optionally a mode + default model + tool surface override.
 *
 * The map key is the `agentType` referenced by `spawn_subagent` calls and
 * `subagent_*` events.
 */
export interface SubagentDefinition {
  /** Backing agent id. Must reference a key in `HarnessConfig.agents`. */
  agentId: string;

  /**
   * Mode the subagent's session runs in. Resolves in `HarnessConfig.modes`.
   * If unset, the subagent inherits the parent's mode.
   */
  modeId?: string;

  /**
   * Surfaced in the parent agent's `spawn_subagent` tool description so
   * the model can pick the right type.
   */
  description: string;

  /**
   * Default model id for this subagent type. Used when the spawn call does
   * not pass `modelOverride`. Falls back to the harness's resolved default
   * for the subagent's mode when unset.
   */
  defaultModelId?: string;

  /**
   * Tool surface override for this subagent type. When set, the subagent
   * runs with exactly these tools (replaces the backing agent's tools).
   * Mutually exclusive with the mode's own `tools` overlay — caller wins.
   */
  tools?: ToolsInput;

  /**
   * Workspace ownership model for the subagent session. `'inherit'` reuses
   * the parent's workspace; `'fresh'` provisions a new one. Default:
   * `'inherit'`. Workspace plumbing lands in a later slice — the field is
   * accepted now so configs don't need to change later.
   */
  workspace?: 'inherit' | 'fresh';
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
  /**
   * @internal — used by the built-in `spawn_subagent` tool to record the
   * child's depth in the subagent tree (parent + 1). Top-level callers
   * should leave this unset; it defaults to `0`.
   */
  subagentDepth?: number;
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

/**
 * Public thread record returned by `harness.threads.*`. A thin façade over
 * the storage layer's `StorageThreadType` so the harness owns the shape its
 * callers see (and so we can swap the backing storage without breaking the
 * sidebar API).
 */
export interface ThreadRecord {
  id: string;
  resourceId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ThreadCreateOptions {
  resourceId: string;
  /** Optional explicit id. Useful for deterministic tests. Otherwise minted. */
  threadId?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface ThreadListOptions {
  resourceId: string;
  /** Number of items per page, or `false` for no limit. Defaults to 100. */
  perPage?: number | false;
  /** Zero-indexed page. Defaults to 0. */
  page?: number;
  /** Sort order — `'createdAt' | 'updatedAt'` × `'ASC' | 'DESC'`. Adapter-defined default. */
  orderBy?: { column: 'createdAt' | 'updatedAt'; direction: 'ASC' | 'DESC' };
  /** AND-matched metadata filter. */
  metadata?: Record<string, unknown>;
}

export interface ThreadListResult {
  threads: ThreadRecord[];
  total: number;
  /** Echoes the requested page size; `false` indicates unbounded (no limit). */
  perPage: number | false;
  page: number;
  hasMore: boolean;
}

export interface ThreadGetOptions {
  resourceId: string;
  threadId: string;
}

export interface ThreadRenameOptions {
  resourceId: string;
  threadId: string;
  title: string;
  /** Optional metadata patch applied at the same time. Shallow-merged. */
  metadata?: Record<string, unknown>;
}

export interface ThreadCloneOptions {
  resourceId: string;
  /** Thread to copy from. Must belong to `resourceId`. */
  threadId: string;
  /** Optional explicit id for the new thread. */
  newThreadId?: string;
  /** Title for the new thread. Defaults to source title with a "(clone)" suffix. */
  title?: string;
  /** Metadata merged on top of `ThreadCloneMetadata` written by storage. */
  metadata?: Record<string, unknown>;
  /** Forwarded to the storage adapter for message-copy filtering. */
  messageLimit?: number;
}

export interface ThreadSelectOrCreateOptions {
  resourceId: string;
  /** If supplied and owned by `resourceId`, returned as-is. Otherwise create. */
  threadId?: string;
  /** Used only when creating. */
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface ThreadDeleteOptions {
  resourceId: string;
  threadId: string;
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

// ---------------------------------------------------------------------------
// queue() — wait-for-idle FIFO turn queue (spec §4.2 / §6).
//
// Semantics summary:
//   * Items append to `pendingQueue` (durable, ordered, capped by
//     `sessions.maxQueueDepth`). Capacity check + append are atomic.
//   * `additionalTools` is intentionally absent — closures can't survive
//     persistence, and per-turn tool surfaces work via `mode` overrides.
//   * Drain runs head-of-line when the session reaches a clean idle
//     boundary; each item runs as a fresh turn with its overrides applied.
//   * Promise resolves with the eventual `AgentResult` (success or failure)
//     once the head turn fully ends — including any suspend → resume cycles.
// ---------------------------------------------------------------------------

/**
 * Per-turn overrides that survive persistence (a strict subset of
 * `MessageOverrides`).
 */
export interface QueueOverrides {
  /** Override the model id for this queued turn. Falls back to session model. */
  model?: string;
  /** Override the active mode for this queued turn. Must be a known mode id. */
  mode?: string;
  /**
   * If `true`, auto-grant any tool-approval interrupts raised during this
   * queued turn. Mirrors `HarnessOverrides.yolo`. Persisted on the queued
   * item so it survives crash replay.
   */
  yolo?: boolean;
}

/** Options accepted by `Session.queue(...)`. */
export interface QueueOptions extends QueueOverrides {
  /** Free-form user content. The only required field. */
  content: string;

  /** Optional pre-uploaded attachments to include with the user message. */
  attachments?: AttachmentRef[];
}

/**
 * Options accepted by `Session.listMessages(...)` (spec §4.2, §4.4).
 *
 * `limit` caps the result to the most recent N messages, still returned
 * oldest-first within that window. Omitting `limit` returns the full
 * thread history.
 *
 * Cursor pagination, role filters, and content-type partitioning are
 * deferred to v1.x — current consumers only need a recent-N readback.
 */
export interface ListMessagesOptions {
  limit?: number;
}

/**
 * Pass-through of the agent's own execution options for the rare case a
 * caller needs to drop down to the raw surface. Most callers should stay on
 * `MessageOptions`.
 */
export type RawAgentExecutionOptions<OUTPUT = unknown> = AgentExecutionOptionsBase<OUTPUT>;

// ---------------------------------------------------------------------------
// HarnessRequestContext (§6.1).
//
// Tools authored for the harness reach this slot via:
//   const ctx = context.requestContext.get('harness') as HarnessRequestContext;
// Spec §6 is the contract for the slot.
// ---------------------------------------------------------------------------

/**
 * `setState` is overloaded:
 *  - Object form does a shallow merge into the current state.
 *  - Function form runs an atomic read-modify-write — the harness reads the
 *    live state at call time, passes it to the updater, persists the return.
 *    The updater MUST be synchronous; async work should happen first, then
 *    the resolved value goes into a fresh setState call.
 */
export type SetStateFn<TState> = {
  (updates: Partial<TState>): Promise<void>;
  (updater: (prev: TState) => TState): Promise<void>;
};

/** Parameters accepted by `ctx.registerQuestion(...)` from a suspending tool. */
export interface RegisterQuestionParams {
  questionId: string;
  question: string;
  options?: Array<{ label: string; description?: string }>;
  selectionMode?: 'single_select' | 'multi_select';
}

/** Parameters accepted by `ctx.registerPlanApproval(...)` from a suspending tool. */
export interface RegisterPlanApprovalParams {
  planId: string;
  title: string;
  plan: string;
}

/**
 * Harness-specific context surfaced on the agent's `RequestContext` under
 * the `'harness'` key. See spec §6 for the full contract.
 *
 * For the parent session: `subagentDepth: 0`, `source: 'parent'`,
 * `parentSessionId` and `subagentToolCallId` undefined.
 * For a subagent: depth ≥ 1, `source: 'subagent'`, parent linkage populated.
 */
export interface HarnessRequestContext<TState = unknown> {
  /** Harness instance id. Useful for log correlation across processes. */
  harnessId: string;
  /** The session this tool invocation runs against. Stable for the call's lifetime. */
  sessionId: string;
  /** The thread the session is bound to. Stable for the call's lifetime. */
  threadId: string;
  /** The resource the session is scoped to. Stable for the call's lifetime. */
  resourceId: string;

  /** Resolved mode id for this turn (with any per-turn overrides applied). */
  modeId: string;

  /** Snapshot of session state at slot construction. Live reads use `getState`. */
  state: TState;
  /** Returns the live state object, reflecting writes from earlier in the same turn. */
  getState: () => TState;
  /** Persisted shallow merge (object form) or atomic read-modify-write (functional form). */
  setState: SetStateFn<TState>;

  /** Turn abort signal. Fires for the four reasons enumerated in §4.5. */
  abortSignal: AbortSignal;

  /** Register a pending question (used by `ask_user` and custom suspending tools). */
  registerQuestion: (params: RegisterQuestionParams) => void;
  /** Register a pending plan approval (used by `submit_plan` and custom suspending tools). */
  registerPlanApproval: (params: RegisterPlanApprovalParams) => void;

  /** Depth of the session in the subagent tree. `0` for the parent. */
  subagentDepth: number;
  /** `'parent'` for the top session, `'subagent'` for any descendant. */
  source: 'parent' | 'subagent';
  /** Parent session id when `source === 'subagent'`. */
  parentSessionId?: string;
  /** Tool call id of the subagent invocation when `source === 'subagent'`. */
  subagentToolCallId?: string;

  /**
   * Subagent model resolver — returns the configured model id for a given
   * agent type, or `null` to fall back to the session's default model.
   */
  getSubagentModel: (params?: { agentType?: string }) => string | null;

  /**
   * Workspace handle (§6.1). Only present when the harness is configured
   * with a workspace and the session has resolved (or can lazily resolve)
   * one. Tools should null-check before use.
   */
  workspace?: Workspace;
}

// ---------------------------------------------------------------------------
// Goals (§4.7).
// ---------------------------------------------------------------------------

/**
 * Options accepted by `Session.setGoal(...)`. `objective` is the only
 * required field. `judgeModel` and `maxTurns` fall back to the harness's
 * `goals.defaultJudgeModel` / `goals.defaultMaxTurns` (in turn defaulting
 * to the session's current model and `50` respectively).
 *
 * `kickoff` controls whether `setGoal` immediately enqueues an initial
 * continuation turn so the agent starts working toward the goal without
 * an explicit `message()` from the caller. Defaults to `true`.
 */
export interface GoalOptions {
  objective: string;
  judgeModel?: string;
  maxTurns?: number;
  kickoff?: boolean;
}
