/**
 * Harness v1 — runtime Session class.
 *
 * This is the in-memory authority for a single SessionRecord (§5.4). The
 * Harness creates one instance per live session and routes all writes to
 * the underlying record through it. The full surface is described in §4.2;
 * the M1 slice ships only identity + lifecycle. Everything else still throws
 * `Not implemented`.
 *
 * Lifecycle states tracked here:
 *   - 'live'    — session is in the harness's live map and holds the lease.
 *   - 'closed'  — `close()` has run; record has `closedAt` set in storage.
 *   - 'evicted' — flushed to storage and dropped from live map; the record
 *                 remains active and the session can be re-hydrated. Currently
 *                 unused; lands with §5.4 idle eviction.
 *
 * Once a Session leaves 'live', every method except identity reads throws.
 * Callers must re-resolve via `harness.session(...)` to get a fresh instance.
 */

import { randomUUID } from 'node:crypto';
import type { z } from 'zod';

import type { AgentExecutionOptionsBase } from '../../agent/agent.types';
import type { ToolsInput } from '../../agent/types';
import { RequestContext } from '../../request-context';
import type { HarnessStorage, PendingResume, QueuedItem, SessionRecord } from '../../storage/domains/harness';
import type { MastraModelOutput, FullOutput } from '../../stream/base/output';

import { convertStoredMessageToHarnessMessage } from '../_shared/message-conversion';
import type { StoredMessageRow } from '../_shared/message-conversion';
import type { HarnessMessage } from '../types';

import { HarnessConfigError, HarnessQueueFullError, HarnessValidationError } from './errors';
import { EventEmitter, assertCustomEventType, assertJsonSerializable } from './events';
import type { EmitInput, HarnessEvent, HarnessEventListener, HarnessEventUnsubscribe } from './events';
import type { Harness } from './harness';
import type {
  AgentResult,
  AgentStream,
  HarnessMode,
  HarnessRequestContext,
  ListMessagesOptions,
  MessageOptions,
  MessageOptionsDefault,
  MessageOptionsStream,
  MessageOptionsStructured,
  QueueOptions,
} from './types';

/**
 * Tool names that the harness translates from `tool-call-approval` /
 * `tool-call-suspended` events into question / plan-approval `kind`s.
 * Built-in convention from spec §7.3 (`ask_user`, `submit_plan`).
 */
const ASK_USER_TOOL_NAME = 'ask_user';
const SUBMIT_PLAN_TOOL_NAME = 'submit_plan';

export type SessionLifecycleState = 'live' | 'closed' | 'evicted';

/**
 * Active-tool tracking for `SessionDisplayState.activeTools`. One entry per
 * `tool_start` that has not yet been settled by a matching `tool_end`. Drops
 * out on `tool_end` regardless of `isError`.
 */
export interface ActiveToolState {
  toolCallId: string;
  toolName: string;
  args: unknown;
  startedAt: number;
  /** Set when this tool call came from a spawned subagent, not the parent. */
  subagentSessionId?: string;
}

/**
 * Active-subagent tracking for `SessionDisplayState.activeSubagents`. Keyed
 * on the parent's `spawn_subagent` tool call id. Dropped on subagent close.
 */
export interface ActiveSubagentState {
  subagentSessionId: string;
  agentType: string;
  task: string;
  parentToolCallId: string;
  startedAt: number;
}

/** Cumulative token usage for the session's thread. */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Point-in-time snapshot returned by `getDisplayState()` (§4.2). Reads off
 * the in-memory `SessionRecord` plus a few transient run-only fields.
 *
 * Persistent thread-level aggregates (task lists, modified-file ledgers, OM
 * progress) deliberately live in `session.state`, not here — see the
 * `getDisplayState()` doc-comment for the split rationale. All `Record<>`
 * collections returned here are fresh on every call; do not mutate them.
 */
export interface SessionDisplayState {
  // Identity
  sessionId: string;
  threadId: string;
  resourceId: string;
  parentSessionId?: string;
  lifecycleState: SessionLifecycleState;
  modeId: string;
  modelId: string;
  createdAt: number;
  lastActivityAt: number;

  // Run
  isRunning: boolean;
  currentRunId?: string;
  currentMessageId?: string;
  currentTraceId?: string;

  // Activity
  activeTools: Record<string, ActiveToolState>;
  toolInputBuffers: Record<string, { toolName: string; text: string }>;
  activeSubagents: Record<string, ActiveSubagentState>;

  // Tokens
  tokenUsage: TokenUsage;

  // Pending interrupt (full payload, not just a boolean — UIs need the args)
  pending: SessionRecord['pendingResume'] | null;

  // Queue
  queueDepth: number;
  currentQueuedItemId?: string;

  // Goal
  goal?: SessionRecord['goal'];
}

/**
 * Internal handle the Harness uses to construct + tear down a Session
 * without exposing those operations on the public API. Plain object so
 * tests can construct a Session in isolation if needed.
 */
export interface SessionInternals {
  harness: Harness;
  storage: HarnessStorage;
  ownerId: string;
  /** Initial record loaded under the lease. The Session takes ownership. */
  record: SessionRecord;
  /** Lease TTL the Harness acquired the lease for. */
  leaseExpiresAt: number;
}

export class Session {
  /** Stable identity. Frozen at construction. */
  readonly id: string;
  readonly resourceId: string;
  readonly threadId: string;
  readonly parentSessionId?: string;
  readonly createdAt: number;

  private _record: SessionRecord;
  private _state: SessionLifecycleState = 'live';
  private readonly _harness: Harness;
  private readonly _storage: HarnessStorage;
  private readonly _ownerId: string;
  private readonly _emitter: EventEmitter;

  /**
   * Queue resolvers indexed by `queuedItem.id`. Set in `queue()` so the
   * caller's promise settles when the head turn completes (or rejects on
   * permanent failure). Cleared after settle. Items recovered from
   * `pendingQueue` on hydration have no resolver — `queue_item_replayed` is
   * emitted instead and the turn runs purely for its side-effects.
   */
  private readonly _queueResolvers = new Map<
    string,
    { resolve: (result: AgentResult) => void; reject: (err: unknown) => void }
  >();
  /** `queuedItem.id` of the turn currently running (live or suspended). */
  private _currentQueuedItemId?: string;
  /** True while `_maybeDrainQueue` is running so re-entrant kicks are no-ops. */
  private _draining = false;
  /**
   * Tracks the AbortController for the currently-running turn (message or
   * queued). Set when a turn begins, cleared on terminal completion or
   * suspension. `session.abort()` calls `abort()` on this controller. Also
   * powers `session.isRunning()` — non-undefined means a turn is in-flight.
   */
  private _currentTurnAbortController?: AbortController;
  /**
   * Transient per-turn tracking surfaced via `getDisplayState()`. Reset at
   * the start of every turn (in `_beginTurn` via `_resetTurnTracking`) and
   * mutated from `_drainStreamToEvents`, `_maybeCaptureSuspend`, and the
   * `_resume` path. Not persisted — these are run-only fields.
   */
  private _currentRunId?: string;
  private _currentMessageId?: string;
  private _currentTraceId?: string;
  private readonly _activeTools = new Map<string, ActiveToolState>();
  private readonly _toolInputBuffers = new Map<string, { toolName: string; text: string }>();
  private readonly _activeSubagents = new Map<string, ActiveSubagentState>();
  /** Cumulative usage for the session's thread. Updated on `agent_end`. */
  private _tokenUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  /**
   * In-process serialization for `_flushUpdate`. Concurrent setters chain
   * onto this so each CAS write reads the latest in-memory version. Without
   * this, two parallel callers both observe `version=N`, both attempt
   * `ifVersion: N`, and the loser hits a `HarnessStorageVersionConflictError`.
   */
  private _flushChain: Promise<void> = Promise.resolve();

  /** @internal — constructed by the Harness, not directly. */
  constructor(internals: SessionInternals) {
    this.id = internals.record.id;
    this.resourceId = internals.record.resourceId;
    this.threadId = internals.record.threadId;
    this.parentSessionId = internals.record.parentSessionId;
    this.createdAt = internals.record.createdAt;

    this._record = internals.record;
    this._harness = internals.harness;
    this._storage = internals.storage;
    this._ownerId = internals.ownerId;
    this._emitter = new EventEmitter({ sessionId: this.id });
  }

  // -------------------------------------------------------------------------
  // Events — §10.
  // -------------------------------------------------------------------------

  /**
   * Subscribe to events emitted on this session. Returns an unsubscribe
   * function. Listeners see only events emitted after `subscribe()` returns;
   * there is no automatic backfill (use `listMessages()` for history).
   *
   * Listener exceptions and rejected promises are isolated — they will not
   * disrupt the producer or other listeners.
   */
  subscribe(listener: HarnessEventListener): HarnessEventUnsubscribe {
    this._assertLive('subscribe()');
    return this._emitter.subscribe(listener);
  }

  /** @internal — used by the Harness to publish events on this session's emitter. */
  _emit(event: EmitInput): HarnessEvent {
    return this._emitter.emit(event);
  }

  /**
   * Emit an event that belongs to a turn (agent_*, text_delta, tool_*,
   * suspension_*). Auto-stamps `queuedItemId` from `_currentQueuedItemId`
   * when a queued turn is running so subscribers can correlate every event
   * back to its `queue()` item.
   */
  private _emitTurnEvent(event: EmitInput): HarnessEvent {
    if (this._currentQueuedItemId !== undefined && (event as { queuedItemId?: string }).queuedItemId === undefined) {
      return this._emitter.emit({ ...event, queuedItemId: this._currentQueuedItemId } as EmitInput);
    }
    return this._emitter.emit(event);
  }

  /** @internal — number of registered listeners (for tests). */
  get _internalListenerCount(): number {
    return this._emitter.listenerCount;
  }

  /**
   * Mark a turn as in-flight and mint the AbortController the agent run will
   * use. `session.abort()` aborts this controller. If the caller supplied
   * their own `AbortSignal`, we forward it into the session controller so a
   * single signal reaches the agent.
   *
   * Returns the controller so the calling path can hand `controller.signal`
   * to `agent.stream` / `agent.generate` / `agent.resumeStream`.
   */
  private _beginTurn(callerSignal: AbortSignal | undefined): AbortController {
    const controller = new AbortController();
    if (callerSignal) {
      if (callerSignal.aborted) {
        controller.abort((callerSignal as { reason?: unknown }).reason);
      } else {
        callerSignal.addEventListener('abort', () => controller.abort((callerSignal as { reason?: unknown }).reason), {
          once: true,
        });
      }
    }
    this._currentTurnAbortController = controller;
    this._resetTurnTracking();
    return controller;
  }

  /**
   * Clear per-turn transient display-state fields. Cumulative aggregates
   * (`_tokenUsage`) intentionally persist across turns within a session.
   */
  private _resetTurnTracking(): void {
    this._currentRunId = undefined;
    this._currentMessageId = undefined;
    this._currentTraceId = undefined;
    this._activeTools.clear();
    this._toolInputBuffers.clear();
    // `_activeSubagents` is keyed by parent tool call id and naturally drops
    // entries on subagent close; do not clear here so a long-running subagent
    // spanning multiple parent turns still renders.
  }

  /**
   * Clear the in-flight turn marker so `isRunning()` reports false and the
   * next `session.abort()` is a no-op. Run-only display fields (`currentRunId`,
   * active-tool map, input buffers) clear too so an idle session reports
   * idle state. Cumulative aggregates (`_tokenUsage`) are preserved.
   */
  private _endTurn(controller: AbortController): void {
    if (this._currentTurnAbortController === controller) {
      this._currentTurnAbortController = undefined;
      this._currentRunId = undefined;
      this._currentMessageId = undefined;
      this._currentTraceId = undefined;
      this._activeTools.clear();
      this._toolInputBuffers.clear();
    }
  }

  /**
   * Fold the `FullOutput` from a completed (or suspended) agent run into the
   * session's transient display state: capture `runId` if not yet set and
   * accumulate token usage. Called from every site that has the full output.
   */
  private _recordTurnCompletion(full: FullOutput<unknown>): void {
    if (full.runId && this._currentRunId === undefined) {
      this._currentRunId = full.runId;
    }
    const usage = (full as { totalUsage?: unknown; usage?: unknown }).totalUsage ?? (full as { usage?: unknown }).usage;
    if (usage && typeof usage === 'object') {
      const u = usage as {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
        inputTokens?: number;
        outputTokens?: number;
      };
      const prompt = u.promptTokens ?? u.inputTokens;
      const completion = u.completionTokens ?? u.outputTokens;
      if (typeof prompt === 'number') this._tokenUsage.promptTokens += prompt;
      if (typeof completion === 'number') this._tokenUsage.completionTokens += completion;
      if (typeof u.totalTokens === 'number') this._tokenUsage.totalTokens += u.totalTokens;
    }
  }

  /**
   * True while a turn (message or queued) is in flight against the agent.
   * Goes back to false on terminal completion, suspension, or abort.
   * Subscribers should drive UI affordances (e.g. spinner, ESC-to-cancel)
   * from this signal in combination with `lifecycleState`.
   */
  isRunning(): boolean {
    return this._currentTurnAbortController !== undefined;
  }

  /**
   * Cancel the in-flight turn (if any). The agent receives the abort signal
   * and unwinds. No-op when no turn is running. The optional `reason` is
   * forwarded as the `AbortSignal.reason` so tools can branch on it.
   */
  abort(opts?: { reason?: string }): void {
    const controller = this._currentTurnAbortController;
    if (!controller) return;
    controller.abort(opts?.reason ?? 'session_aborted');
  }

  /** @internal — emitter epoch (for tests). */
  get _internalEmitterEpoch(): string {
    return this._emitter.epochId;
  }

  // -------------------------------------------------------------------------
  // Identity / inspection — usable in any lifecycle state.
  // -------------------------------------------------------------------------

  /** Last-known `lastActivityAt`. Updated whenever the record is flushed. */
  get lastActivityAt(): number {
    return this._record.lastActivityAt;
  }

  /** Current lifecycle state. */
  get lifecycleState(): SessionLifecycleState {
    return this._state;
  }

  /** True once `close()` has settled. */
  get isClosed(): boolean {
    return this._state === 'closed';
  }

  /** Read-only snapshot of the underlying record. */
  getRecord(): Readonly<SessionRecord> {
    return this._record;
  }

  // -------------------------------------------------------------------------
  // Lifecycle.
  // -------------------------------------------------------------------------

  /**
   * Soft-close: flush, set `closedAt`, release the lease, drop from the live
   * map. Final — the same `sessionId` cannot be re-hydrated. Idempotent: a
   * second call is a no-op once `closed`. The cascade through descendants
   * (§5.5) is driven by the Harness, not by this method directly.
   *
   * @internal — public users go through `harness.closeSession({ sessionId })`
   * or `session.close()` (defined here) which currently delegates back to
   * the harness so cascade is enforced in one place. We expose this method
   * so the harness has a clear hook; the harness method is still the
   * recommended call site.
   */
  async close(): Promise<void> {
    if (this._state === 'closed') return;
    await this._harness._closeSession(this);
  }

  // -------------------------------------------------------------------------
  // message() — §4.2.
  //
  // Always-accept signal-driven entry point. Three return shapes:
  //
  //   * default                          → AgentResult (await everything)
  //   * { stream: true }                 → live MastraModelOutput
  //   * { output: schema, sync: true }   → fail-fast structured object
  //
  // The signal-routing pathway in the spec (§4.2) is not yet shipped on the
  // agent layer, so for M1 we wire directly to `agent.stream()` /
  // `agent.generate()`. When sendSignal lands we'll route the active-run
  // case through it without changing this surface.
  // -------------------------------------------------------------------------

  /** Default: bundle the full agent output and return when the run finishes. */
  async message(opts: MessageOptionsDefault): Promise<AgentResult>;
  /** Streaming: hand the live `MastraModelOutput` back to the caller. */
  async message(opts: MessageOptionsStream): Promise<AgentStream>;
  /** Structured + sync: fail-fast typed object output. */
  async message<S extends z.ZodTypeAny>(opts: MessageOptionsStructured<S>): Promise<z.infer<S>>;
  async message(opts: MessageOptions): Promise<AgentResult | AgentStream | unknown> {
    this._assertLive('message()');

    if (opts.stream === true && opts.output !== undefined) {
      throw new HarnessConfigError('message()', '`stream: true` and `output` are mutually exclusive');
    }
    if (opts.output !== undefined && opts.sync !== true) {
      throw new HarnessConfigError('message()', 'structured `output` requires `sync: true` (typed turn boundary)');
    }

    // Resolve the effective mode (per-call override wins, else session's).
    const effectiveModeId = opts.mode ?? this._record.modeId;
    const mode = this._harness._getMode(effectiveModeId);
    const agent = this._harness.getAgentForMode(effectiveModeId);

    // Per-turn additionalTools merge with the mode's surface, never replace.
    const toolsets = this._buildToolsets(mode, opts.additionalTools);

    // Every turn runs under a session-owned AbortController so
    // `session.abort()` can cancel the in-flight run. If the caller passes
    // their own AbortSignal, we forward it into the session controller so
    // both paths converge on a single signal handed to the agent.
    const turnAbortController = this._beginTurn(opts.abortSignal);
    const turnAbortSignal = turnAbortController.signal;
    const requestContext = this._buildRequestContext({
      modeId: effectiveModeId,
      abortSignal: turnAbortSignal,
    });

    const baseExecOptions: AgentExecutionOptionsBase<unknown> = {
      memory: { thread: this.threadId, resource: this.resourceId },
      abortSignal: turnAbortSignal,
      requestContext,
      ...(toolsets ? { toolsets } : {}),
      ...(mode.instructions ? { instructions: mode.instructions } : {}),
    };

    // agent_start signals the turn has begun. Subscribers can latch their
    // accumulators here. Emitted before either agent.stream() or
    // agent.generate() so structured/sync paths still see the boundary.
    this._emitTurnEvent({ type: 'agent_start' });

    // Structured + sync path: agent.generate with structuredOutput.
    if (opts.output !== undefined && opts.sync === true) {
      try {
        const result = await agent.generate(opts.content, {
          ...baseExecOptions,
          structuredOutput: { schema: opts.output as never },
        });
        const full = result as FullOutput<unknown>;
        this._recordTurnCompletion(full);
        await this._maybeCaptureSuspend(full);
        this._emitTurnEvent({
          type: 'agent_end',
          reason: full.finishReason === 'suspended' ? 'suspended' : 'complete',
          runId: full.runId,
        });
        return full.object;
      } finally {
        this._endTurn(turnAbortController);
      }
    }

    // Streaming path: hand the live MastraModelOutput back. We drain the
    // stream ourselves to emit harness events; the caller's
    // `getFullOutput()` is independent (each `fullStream` call returns a
    // fresh evented stream). Errors during drain are swallowed — the
    // caller already owns the visible stream. The turn stays in-flight
    // until the drain settles so `isRunning()` stays true while the model
    // is still producing chunks.
    if (opts.stream === true) {
      try {
        const out = await agent.stream(opts.content, baseExecOptions);
        const drain = this._drainStreamToEvents(out as MastraModelOutput<unknown>);
        void drain.finally(() => this._endTurn(turnAbortController));
        return out as MastraModelOutput<unknown>;
      } catch (err) {
        // agent.stream() itself rejected before we had a stream to drain —
        // make sure the turn marker doesn't leak.
        this._endTurn(turnAbortController);
        throw err;
      }
    }

    // Default path: drain the stream for events, then resolve via
    // getFullOutput to surface the bundled result.
    try {
      const out = await agent.stream(opts.content, baseExecOptions);
      await this._drainStreamToEvents(out as MastraModelOutput<unknown>);
      const full = await out.getFullOutput();
      this._recordTurnCompletion(full);
      await this._maybeCaptureSuspend(full);
      this._emitTurnEvent({
        type: 'agent_end',
        reason: full.finishReason === 'suspended' ? 'suspended' : 'complete',
        runId: full.runId,
      });
      return full;
    } finally {
      this._endTurn(turnAbortController);
    }
  }

  /**
   * Drain a `MastraModelOutput.fullStream` once, emitting the corresponding
   * harness events as chunks arrive. Returns when the stream completes.
   *
   * Chunks observed → events emitted:
   *   - `text-delta`           → `text_delta`
   *   - `tool-call`            → `tool_start`
   *   - `tool-result`          → `tool_end` (isError: false)
   *   - `tool-error`           → `tool_end` (isError: true)
   *
   * Approval / suspension chunks are intentionally NOT mapped here. The
   * harness uses `_maybeCaptureSuspend` after `getFullOutput()` to persist
   * the pending record under the lease and emit `suspension_required` after
   * the durable-parking barrier. Emitting events from the streaming path
   * would race with that commit.
   */
  private async _drainStreamToEvents(out: MastraModelOutput<unknown>): Promise<void> {
    try {
      for await (const chunk of out.fullStream) {
        // Capture run identity from the first chunk that carries it so
        // `getDisplayState().currentRunId` is populated for the in-flight turn.
        const runId = (chunk as { runId?: string }).runId;
        if (runId && this._currentRunId === undefined) {
          this._currentRunId = runId;
        }
        switch (chunk.type) {
          case 'text-delta': {
            const payload = chunk.payload as { text?: string };
            if (typeof payload?.text === 'string' && payload.text.length > 0) {
              this._emitTurnEvent({ type: 'text_delta', delta: payload.text });
            }
            break;
          }
          case 'tool-call': {
            const payload = chunk.payload as { toolCallId: string; toolName: string; args: unknown };
            this._activeTools.set(payload.toolCallId, {
              toolCallId: payload.toolCallId,
              toolName: payload.toolName,
              args: payload.args,
              startedAt: Date.now(),
            });
            this._toolInputBuffers.delete(payload.toolCallId);
            this._emitTurnEvent({
              type: 'tool_start',
              toolCallId: payload.toolCallId,
              toolName: payload.toolName,
              args: payload.args,
            });
            break;
          }
          case 'tool-result': {
            const payload = chunk.payload as { toolCallId: string; result: unknown; isError?: boolean };
            this._activeTools.delete(payload.toolCallId);
            this._emitTurnEvent({
              type: 'tool_end',
              toolCallId: payload.toolCallId,
              result: payload.result,
              isError: payload.isError ?? false,
            });
            break;
          }
          case 'tool-error': {
            const payload = chunk.payload as { toolCallId: string; error: unknown };
            this._activeTools.delete(payload.toolCallId);
            this._emitTurnEvent({
              type: 'tool_end',
              toolCallId: payload.toolCallId,
              result: payload.error,
              isError: true,
            });
            break;
          }
          default:
            // All other chunk types (start/finish, reasoning, source, file,
            // tool-call-input-streaming-*, abort, raw, …) are intentionally
            // ignored at the harness event layer for v1. UIs that need them
            // can subscribe to the agent's stream directly via stream:true.
            break;
        }
      }
    } catch {
      // The caller still owns the visible promise — keep the drain best-
      // effort so a stream-level error doesn't surface twice.
    }
  }

  /**
   * If the agent run finished suspended, persist a `PendingResume` pointer
   * derived from `FullOutput.suspendPayload` + `runId`. Subsequent calls to
   * `respondTool*` use this pointer to call `agent.resumeStream(...)`.
   *
   * Maps the agent's `tool-call-approval` / `tool-call-suspended` chunks to
   * the four harness-layer kinds:
   *   - tool name `ask_user`     → 'question'
   *   - tool name `submit_plan`  → 'plan-approval'
   *   - payload has `suspendPayload` → 'tool-suspension'
   *   - else                          → 'tool-approval'
   *
   * No-op when the run did not suspend.
   */
  private async _maybeCaptureSuspend(full: FullOutput<unknown>): Promise<void> {
    if (full.finishReason !== 'suspended') return;
    const payload = full.suspendPayload as
      | { toolCallId: string; toolName: string; args?: unknown; suspendPayload?: unknown }
      | undefined;
    if (!payload || !full.runId) return;

    const kind = this._classifyResumeKind(payload);
    const pending: PendingResume = {
      kind,
      runId: full.runId,
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      source: 'parent',
      requestedAt: Date.now(),
      payload: this._buildResumePayload(kind, payload),
    };

    if (kind === 'plan-approval') {
      const mode = this._harness._getMode(this._record.modeId);
      if (mode.transitionsTo) pending.transitionModeId = mode.transitionsTo;
    }

    await this._flushUpdate(prev => ({ ...prev, pendingResume: pending }));

    // Emit suspension_required AFTER the durable-parking barrier (§5.4) so
    // any subscriber observing this event can reconstruct the pending state
    // from storage.
    this._emitTurnEvent({
      type: 'suspension_required',
      kind,
      toolCallId: pending.toolCallId,
      toolName: pending.toolName,
      runId: pending.runId,
    });
  }

  private _classifyResumeKind(payload: { toolName: string; suspendPayload?: unknown }): PendingResume['kind'] {
    if (payload.toolName === ASK_USER_TOOL_NAME) return 'question';
    if (payload.toolName === SUBMIT_PLAN_TOOL_NAME) return 'plan-approval';
    if ('suspendPayload' in payload && payload.suspendPayload !== undefined) return 'tool-suspension';
    return 'tool-approval';
  }

  private _buildResumePayload(
    kind: PendingResume['kind'],
    payload: { args?: unknown; suspendPayload?: unknown },
  ): PendingResume['payload'] {
    switch (kind) {
      case 'tool-approval':
        return { input: payload.args };
      case 'tool-suspension':
        return { input: payload.args, suspendData: payload.suspendPayload };
      case 'question': {
        const args = (payload.args ?? {}) as {
          question?: string;
          options?: { label: string; description?: string }[];
          selectionMode?: 'single_select' | 'multi_select';
        };
        return {
          question: args.question,
          options: args.options,
          selectionMode: args.selectionMode,
        };
      }
      case 'plan-approval': {
        const args = (payload.args ?? {}) as { title?: string; plan?: string };
        return { title: args.title, plan: args.plan };
      }
    }
  }

  // -------------------------------------------------------------------------
  // Mode / model getters + setters — §4.2.
  //
  // The session is the local authority for the active mode/model id; the
  // backing agent is selected via Harness lookup. Setters CAS-write through
  // storage so a concurrent harness instance that holds the lease cannot
  // observe a stale value.
  // -------------------------------------------------------------------------

  /** Resolved active mode (per the session record). */
  getCurrentMode(): HarnessMode {
    this._assertLive('getCurrentMode()');
    return this._harness._getMode(this._record.modeId);
  }

  /** Active model id for the session. */
  getCurrentModel(): string {
    this._assertLive('getCurrentModel()');
    return this._record.modelId;
  }

  /**
   * Switch the active mode for subsequent turns. The backing agent flips
   * with the next `message()`/`queue()` call. Throws if the mode id is
   * unknown.
   */
  async switchMode(opts: { mode: string }): Promise<void> {
    this._assertLive('switchMode()');
    // Validates and throws on unknown id.
    this._harness._getMode(opts.mode);
    const previousModeId = this._record.modeId;
    if (previousModeId === opts.mode) return;
    await this._flushUpdate(prev => ({ ...prev, modeId: opts.mode }));
    this._emitter.emit({ type: 'mode_changed', modeId: opts.mode, previousModeId });
  }

  /** Switch the active model id. Free-form string — validated by the agent layer. */
  async switchModel(opts: { model: string }): Promise<void> {
    this._assertLive('switchModel()');
    const previousModelId = this._record.modelId;
    if (previousModelId === opts.model) return;
    await this._flushUpdate(prev => ({ ...prev, modelId: opts.model }));
    this._emitter.emit({ type: 'model_changed', modelId: opts.model, previousModelId });
  }

  // -------------------------------------------------------------------------
  // Custom state (§4.2 / §6.1).
  //
  // The session holds an opaque typed state blob persisted alongside the
  // SessionRecord. The two write forms are equivalent surfaces, but the
  // functional form gives tools an atomic read-modify-write that doesn't
  // stomp concurrent writes from earlier in the same turn.
  // -------------------------------------------------------------------------

  /** Returns the current state. Always resolves with the latest persisted value. */
  async getState<TState = unknown>(): Promise<TState> {
    this._assertLive('getState()');
    return (this._record.state ?? {}) as TState;
  }

  /**
   * Replace or merge the session state. The object form does a shallow merge;
   * the functional form atomically reads the current state, runs the updater,
   * and writes the result. The functional form is the right choice for tools
   * that bump counters or otherwise depend on the previous value.
   */
  setState<TState = unknown>(updates: Partial<TState>): Promise<void>;
  setState<TState = unknown>(updater: (prev: TState) => TState): Promise<void>;
  async setState<TState = unknown>(updatesOrUpdater: Partial<TState> | ((prev: TState) => TState)): Promise<void> {
    this._assertLive('setState()');
    await this._flushUpdate(prev => {
      const current = (prev.state ?? {}) as TState;
      const next =
        typeof updatesOrUpdater === 'function'
          ? (updatesOrUpdater as (prev: TState) => TState)(current)
          : ({ ...(current as object), ...(updatesOrUpdater as object) } as TState);
      return { ...prev, state: next };
    });
  }

  // -------------------------------------------------------------------------
  // getDisplayState — §4.2.
  //
  // Point-in-time snapshot used by TUIs / Studio. Reads off the in-memory
  // `SessionRecord` plus transient per-turn tracking (`_currentRunId`,
  // `_activeTools`, `_toolInputBuffers`, `_activeSubagents`, `_tokenUsage`).
  // Doesn't touch storage. Returned Record/Map projections are fresh on
  // every call — do not mutate them.
  //
  // Persistent thread-level aggregates (task lists, modified-file ledgers,
  // OM progress) live in `session.state`, not here — see the spec doc-comment
  // in §4.2 for the split rationale.
  // -------------------------------------------------------------------------

  getDisplayState(): SessionDisplayState {
    this._assertLive('getDisplayState()');
    const rec = this._record;
    const snapshot: SessionDisplayState = {
      // Identity
      sessionId: this.id,
      threadId: this.threadId,
      resourceId: this.resourceId,
      lifecycleState: this._state,
      modeId: rec.modeId,
      modelId: rec.modelId,
      createdAt: this.createdAt,
      lastActivityAt: rec.lastActivityAt,

      // Run
      isRunning: this.isRunning(),

      // Activity — fresh projections so callers can't mutate internal maps
      activeTools: Object.fromEntries(this._activeTools.entries()),
      toolInputBuffers: Object.fromEntries(this._toolInputBuffers.entries()),
      activeSubagents: Object.fromEntries(this._activeSubagents.entries()),

      // Tokens — copy so the caller can't mutate the running aggregate
      tokenUsage: { ...this._tokenUsage },

      // Pending interrupt — full payload, single field (see §5.1)
      pending: rec.pendingResume ?? null,

      // Queue
      queueDepth: rec.pendingQueue.length,
    };
    if (this.parentSessionId !== undefined) snapshot.parentSessionId = this.parentSessionId;
    if (this._currentRunId !== undefined) snapshot.currentRunId = this._currentRunId;
    if (this._currentMessageId !== undefined) snapshot.currentMessageId = this._currentMessageId;
    if (this._currentTraceId !== undefined) snapshot.currentTraceId = this._currentTraceId;
    if (this._currentQueuedItemId !== undefined) snapshot.currentQueuedItemId = this._currentQueuedItemId;
    if (rec.goal !== undefined) snapshot.goal = rec.goal;
    return snapshot;
  }

  // -------------------------------------------------------------------------
  // listMessages — §4.2, §4.4.
  //
  // Read-only history readback for this session's thread, returned
  // oldest-first. Delegates to the memory storage domain on the bound Mastra
  // instance and maps each row into the public `HarnessMessage` partition
  // (spec §11.1) via the shared converter.
  //
  // Returns `[]` when memory storage is not configured (e.g. ad-hoc threads,
  // tests with no storage wired). Throws if the session is no longer live.
  // -------------------------------------------------------------------------

  async listMessages(opts?: ListMessagesOptions): Promise<HarnessMessage[]> {
    this._assertLive('listMessages()');
    const memory = await this._harness._internalTryGetMemoryStorage();
    if (!memory) return [];

    const limit = opts?.limit;
    if (limit !== undefined && (!Number.isFinite(limit) || limit < 0 || !Number.isInteger(limit))) {
      throw new HarnessValidationError('limit', `\`limit\` must be a non-negative integer; received ${String(limit)}`);
    }
    if (limit === 0) return [];

    // When `limit` is set, fetch the most recent N (DESC) and reverse to
    // restore chronological order. Otherwise fetch the full thread history
    // in natural order — mirrors the legacy harness's two-path behaviour.
    if (limit !== undefined) {
      const result = await memory.listMessages({
        threadId: this.threadId,
        perPage: limit,
        page: 0,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      return result.messages
        .slice()
        .reverse()
        .map(msg => convertStoredMessageToHarnessMessage(msg as unknown as StoredMessageRow));
    }

    const result = await memory.listMessages({ threadId: this.threadId, perPage: false });
    return result.messages.map(msg => convertStoredMessageToHarnessMessage(msg as unknown as StoredMessageRow));
  }

  // -------------------------------------------------------------------------
  // Suspend / resume — §4.2.
  //
  // When `message()` (or a queued turn) finishes with `finishReason
  // === 'suspended'`, the harness persists a `PendingResume` record holding
  // the agent's `runId` + `toolCallId` + UX-facing payload. Callers respond
  // through one of four typed entry points; all funnel into `_resume(...)`,
  // which is the single place that calls `agent.resumeStream(...)`.
  //
  // `pendingResume.resumedAt` is set under the lease before the agent call so
  // a crash between "marked resumed" and "cleared pending" replays as a no-op
  // on rehydration (idempotent at-least-once).
  // -------------------------------------------------------------------------

  /** Resume a pending tool-approval. `approved: false` rejects the call. */
  async respondToToolApproval(opts: { approved: boolean }): Promise<AgentResult> {
    return this._resume('tool-approval', { approved: opts.approved });
  }

  /** Resume a pending tool-suspension. `resumeData` is forwarded to the tool. */
  async respondToToolSuspension(opts: { resumeData: unknown }): Promise<AgentResult> {
    return this._resume('tool-suspension', opts.resumeData);
  }

  /** Resume a pending `ask_user` question. */
  async respondToQuestion(opts: { answer: unknown }): Promise<AgentResult> {
    return this._resume('question', { answer: opts.answer });
  }

  /**
   * Resume a pending `submit_plan` approval. On `approved: true` the harness
   * also flips the active mode if the submitting mode declared `transitionsTo`,
   * recording the flip via `approvedTransitionModeId` /
   * `modeTransitionAppliedAt` for idempotent replay.
   */
  async respondToPlanApproval(opts: { approved: boolean; feedback?: string }): Promise<AgentResult> {
    return this._resume('plan-approval', { approved: opts.approved, feedback: opts.feedback });
  }

  private async _resume(expectedKind: PendingResume['kind'], resumeData: unknown): Promise<AgentResult> {
    this._assertLive(`respond[${expectedKind}]`);

    const pending = this._record.pendingResume;
    if (!pending) {
      throw new HarnessValidationError(`respond[${expectedKind}]`, 'no pending resume on this session');
    }
    if (pending.kind !== expectedKind) {
      throw new HarnessValidationError(
        `respond[${expectedKind}]`,
        `pending resume is "${pending.kind}", not "${expectedKind}"`,
      );
    }

    // Idempotency: a crash between "marked resumed" and "cleared pending"
    // surfaces here on the next call. We do not replay the agent — the prior
    // resumeStream() either landed (and cleared pending in a later flush we
    // lost) or is being completed by a sibling caller. Either way, the safe
    // move is to surface the suspended state to the caller and let them
    // re-fetch via getDisplayState / listMessages.
    if (pending.resumedAt !== undefined) {
      throw new HarnessValidationError(
        `respond[${expectedKind}]`,
        'pending resume already responded; awaiting agent confirmation',
      );
    }

    // Mark resumed under the lease BEFORE calling the agent (idempotency
    // marker per §5.4 / §5.7). On crash here, the next caller observes
    // resumedAt set and rejects rather than double-resuming.
    const resumedAt = Date.now();
    await this._flushUpdate(prev => ({
      ...prev,
      pendingResume: prev.pendingResume ? { ...prev.pendingResume, resumedAt } : prev.pendingResume,
    }));

    // For plan-approval, flip the active mode atomically with clearing the
    // pending record. Done inside the same _flushUpdate below so the mode
    // change and pending-clear land in one CAS write.
    let modeFlipTarget: string | undefined;
    if (expectedKind === 'plan-approval') {
      const data = resumeData as { approved: boolean };
      if (data.approved && pending.transitionModeId && pending.transitionModeId !== this._record.modeId) {
        // Validate the target mode exists before we hand off to the agent.
        this._harness._getMode(pending.transitionModeId);
        modeFlipTarget = pending.transitionModeId;
      }
    }

    // Resumed runs run under a session-owned AbortController too, so
    // `session.abort()` can cancel an in-flight resume (e.g. ESC after the
    // user approved a tool that's now grinding through a long workflow).
    const turnAbortController = this._beginTurn(undefined);
    const agent = this._harness.getAgentForMode(this._record.modeId);
    let full: FullOutput<unknown>;
    try {
      const out = await agent.resumeStream(resumeData, {
        runId: pending.runId,
        toolCallId: pending.toolCallId,
        abortSignal: turnAbortController.signal,
      });
      full = (await out.getFullOutput()) as FullOutput<unknown>;
      this._recordTurnCompletion(full);
    } catch (err) {
      this._endTurn(turnAbortController);
      throw err;
    }

    // Clear pending + apply mode flip in a single CAS write. The mode flip
    // and pending-clear must land together so a replay does not see
    // "pending cleared, mode not yet flipped" or vice versa.
    const previousModeId = this._record.modeId;
    await this._flushUpdate(prev => {
      const next: SessionRecord = { ...prev };
      delete next.pendingResume;
      if (modeFlipTarget) next.modeId = modeFlipTarget;
      return next;
    });

    // Pending resolved — emit before the (optional) re-suspension capture
    // so subscribers see ordering: resolved → (mode_changed?) → required?.
    this._emitTurnEvent({
      type: 'suspension_resolved',
      kind: expectedKind,
      toolCallId: pending.toolCallId,
      runId: pending.runId,
    });
    if (modeFlipTarget && modeFlipTarget !== previousModeId) {
      this._emitter.emit({
        type: 'mode_changed',
        modeId: modeFlipTarget,
        previousModeId,
      });
    }

    // The resumed run can itself suspend again (multi-step approval chains).
    // Mirror message()'s post-run hook so the next respond* call sees the
    // new pending record.
    await this._maybeCaptureSuspend(full);

    // If the resumed run did NOT suspend again, the turn is complete from
    // the harness's perspective. Surface that to subscribers via agent_end.
    if (full.finishReason !== 'suspended') {
      this._emitTurnEvent({
        type: 'agent_end',
        reason: full.finishReason === 'error' ? 'error' : 'complete',
        runId: full.runId,
      });

      // If this was the terminal completion of a queued turn, settle the
      // resolver, remove the head item, clear current, then kick the drain
      // for the next item.
      if (this._currentQueuedItemId !== undefined) {
        await this._completeQueuedTurn(this._currentQueuedItemId, full as AgentResult);
      }
    }
    this._endTurn(turnAbortController);
    return full as AgentResult;
  }

  // -------------------------------------------------------------------------
  // queue() — wait-for-idle FIFO turn queue (§4.2 / §6).
  //
  // Append-then-drain. The capacity check + durable append are atomic per
  // session: two concurrent `queue()` calls on the same Session instance
  // race on the in-process `_flushUpdate` lock, so neither can both observe
  // available space and commit past the cap. Cross-instance contention is
  // covered by the lease + version CAS on the underlying record.
  //
  // Drain semantics:
  //   1. `queue()` admits → flush record → register resolver → kick drain.
  //   2. Drain pulls head item, emits `queue_item_started`, runs the turn
  //      via the same code path as `message()` default (so `agent_start`,
  //      `text_delta`, `tool_*`, `suspension_*`, `agent_end` all flow with
  //      `queuedItemId` stamped automatically by `_emitTurnEvent`).
  //   3. If the turn suspends, the head item stays in `pendingQueue` and
  //      `_currentQueuedItemId` stays set. The next `respondTo*` call calls
  //      into `_resume`; on terminal completion the resume path settles the
  //      resolver + removes the head + kicks drain again.
  //   4. If the turn completes without suspending, the message() default
  //      path settles the same way (post-`agent_end` hook below).
  //
  // Promise resolution: the eventual `AgentResult` once the turn fully ends
  // (including any suspend → resume cycles). Rejection only for "never got
  // to run" cases (closed session before drain reached the item, or a
  // permanent storage failure during admission).
  // -------------------------------------------------------------------------

  /**
   * Append a turn to the durable queue. Resolves with the eventual
   * `AgentResult` once the turn fully completes — including any
   * suspend → resume cycles.
   *
   * Rejects synchronously with:
   *   - `HarnessConfigError` if the session is not live, or `mode` is unknown.
   *   - `HarnessValidationError` if `content` is empty.
   *   - `HarnessQueueFullError` if `pendingQueue.length` is already at
   *     `sessions.maxQueueDepth`.
   */
  async queue(opts: QueueOptions): Promise<AgentResult> {
    this._assertLive('queue()');
    if (typeof opts.content !== 'string' || opts.content.length === 0) {
      throw new HarnessValidationError('queue().content', 'must be a non-empty string');
    }
    if (opts.mode !== undefined) {
      // Validates and throws on unknown id.
      this._harness._getMode(opts.mode);
    }

    const cap = this._harness._internalMaxQueueDepth;
    if ((this._record.pendingQueue?.length ?? 0) >= cap) {
      throw new HarnessQueueFullError(this.id, cap);
    }

    const item: QueuedItem = {
      id: `q-${randomUUID()}`,
      enqueuedAt: Date.now(),
      content: opts.content,
      attachments: [],
      ...(opts.model !== undefined ? { model: opts.model } : {}),
      ...(opts.mode !== undefined ? { mode: opts.mode } : {}),
      ...(opts.yolo !== undefined ? { yolo: opts.yolo } : {}),
    };

    // Atomic check + append: re-check capacity inside the updater so a
    // concurrent in-process `queue()` cannot push us past the cap.
    let admitted = true;
    await this._flushUpdate(prev => {
      if ((prev.pendingQueue?.length ?? 0) >= cap) {
        admitted = false;
        return prev;
      }
      return { ...prev, pendingQueue: [...(prev.pendingQueue ?? []), item] };
    });
    if (!admitted) {
      throw new HarnessQueueFullError(this.id, cap);
    }

    return new Promise<AgentResult>((resolve, reject) => {
      this._queueResolvers.set(item.id, { resolve, reject });
      // Kick the drain — fire-and-forget. Drain handles its own errors and
      // settles the resolver via `_completeQueuedTurn` / `_failQueuedTurn`.
      void this._maybeDrainQueue();
    });
  }

  /**
   * Drain pending queue items head-of-line. No-op while another drain is
   * running, the session is suspended (`pendingResume` set), or the queue
   * is empty. Each item runs as a fresh turn; if the turn suspends, drain
   * exits early and resumes from `_resume()` once the user responds.
   */
  private async _maybeDrainQueue(): Promise<void> {
    if (this._draining) return;
    if (this._state !== 'live') return;
    // A live suspension means a previous queued turn is awaiting a
    // `respondTo*` call — drain stays parked until that resolves.
    if (this._record.pendingResume !== undefined) return;
    if (this._currentQueuedItemId !== undefined) return;

    this._draining = true;
    try {
      while (this._state === 'live' && (this._record.pendingQueue?.length ?? 0) > 0) {
        // Bail if a previous iteration left the session suspended.
        if (this._record.pendingResume !== undefined) return;

        const head = this._record.pendingQueue?.[0];
        if (!head) return;
        this._currentQueuedItemId = head.id;
        const isReplay = !this._queueResolvers.has(head.id);
        this._emitter.emit(
          isReplay
            ? { type: 'queue_item_replayed', queuedItemId: head.id }
            : { type: 'queue_item_started', queuedItemId: head.id },
        );

        let suspended = false;
        try {
          const full = await this._runQueuedTurn(head);
          suspended = full.finishReason === 'suspended';
          if (!suspended) {
            await this._completeQueuedTurn(head.id, full as AgentResult);
          }
        } catch (err) {
          // Permanent failure during the turn — reject the resolver and
          // remove the item so we don't replay it forever.
          await this._failQueuedTurn(head.id, err);
        }

        if (suspended) {
          // Stop draining; `_resume()` will re-kick when the user responds.
          return;
        }
      }
    } finally {
      this._draining = false;
    }
  }

  /**
   * Run a single queued item as a turn. Mirrors `message()`'s default path
   * but pulls overrides off the queued item rather than per-call options.
   * Returns the `FullOutput` so the drain loop can decide whether the head
   * stays in place (suspended) or is removed (complete / error).
   */
  private async _runQueuedTurn(item: QueuedItem): Promise<FullOutput<unknown>> {
    const effectiveModeId = item.mode ?? this._record.modeId;
    const mode = this._harness._getMode(effectiveModeId);
    const agent = this._harness.getAgentForMode(effectiveModeId);

    const toolsets = this._buildToolsets(mode);
    // Queued turns run under a session-owned AbortController so
    // `session.abort()` can cancel an in-flight queued run too.
    const turnAbortController = this._beginTurn(undefined);
    const requestContext = this._buildRequestContext({
      modeId: effectiveModeId,
      abortSignal: turnAbortController.signal,
    });
    const baseExecOptions: AgentExecutionOptionsBase<unknown> = {
      memory: { thread: this.threadId, resource: this.resourceId },
      abortSignal: turnAbortController.signal,
      requestContext,
      ...(toolsets ? { toolsets } : {}),
      ...(mode.instructions ? { instructions: mode.instructions } : {}),
    };

    this._emitTurnEvent({ type: 'agent_start' });

    try {
      const out = await agent.stream(item.content, baseExecOptions);
      await this._drainStreamToEvents(out as MastraModelOutput<unknown>);
      const full = await out.getFullOutput();
      this._recordTurnCompletion(full);
      await this._maybeCaptureSuspend(full);
      this._emitTurnEvent({
        type: 'agent_end',
        reason: full.finishReason === 'suspended' ? 'suspended' : 'complete',
        runId: full.runId,
      });
      return full;
    } finally {
      this._endTurn(turnAbortController);
    }
  }

  /**
   * Settle a queued item's resolver with success and remove it from the
   * head of `pendingQueue`. The CAS write here is the durable record that
   * the item ran exactly once. Crash recovery uses `pendingQueue[0]` and
   * the absence of `pendingResume` to decide whether to replay.
   */
  private async _completeQueuedTurn(itemId: string, result: AgentResult): Promise<void> {
    await this._flushUpdate(prev => ({
      ...prev,
      pendingQueue: (prev.pendingQueue ?? []).filter(x => x.id !== itemId),
    }));
    this._currentQueuedItemId = undefined;
    const resolver = this._queueResolvers.get(itemId);
    if (resolver) {
      this._queueResolvers.delete(itemId);
      resolver.resolve(result);
    }
    // Kick the drain again — there may be more items waiting.
    void this._maybeDrainQueue();
  }

  /** Same as `_completeQueuedTurn` but rejects the resolver with `err`. */
  private async _failQueuedTurn(itemId: string, err: unknown): Promise<void> {
    await this._flushUpdate(prev => ({
      ...prev,
      pendingQueue: (prev.pendingQueue ?? []).filter(x => x.id !== itemId),
    }));
    this._currentQueuedItemId = undefined;
    const resolver = this._queueResolvers.get(itemId);
    if (resolver) {
      this._queueResolvers.delete(itemId);
      resolver.reject(err);
    }
    void this._maybeDrainQueue();
  }

  /** @internal — used by the Harness on hydration to start replay drain. */
  async _kickQueueDrain(): Promise<void> {
    return this._maybeDrainQueue();
  }

  // -------------------------------------------------------------------------
  // Internal helpers.
  // -------------------------------------------------------------------------

  private _assertLive(method: string): void {
    if (this._state !== 'live') {
      throw new HarnessConfigError(method, `session is ${this._state}`);
    }
  }

  /**
   * Apply an update to the in-memory record, CAS-write to storage, and
   * adopt the returned version. Single point of truth so every setter
   * stays consistent with the lease + version contract (§5.8).
   */
  private _flushUpdate(update: (prev: SessionRecord) => SessionRecord): Promise<void> {
    const run = async (): Promise<void> => {
      const next: SessionRecord = {
        ...update(this._record),
        lastActivityAt: Date.now(),
      };
      const saved = await this._storage.saveSession(next, {
        ownerId: this._ownerId,
        ifVersion: this._record.version,
      });
      this._record = { ...next, version: saved.version };
    };
    // Chain so concurrent callers serialize against the latest in-memory
    // version. Swallow chain-link errors so one caller's failure doesn't
    // poison subsequent flushes.
    const next = this._flushChain.then(run, run);
    this._flushChain = next.catch(() => {});
    return next;
  }

  /**
   * Build the toolset surface for a single turn:
   *   - mode.tools (replace) wins over agent's own tools
   *   - mode.additionalTools merges with agent's tools
   *   - per-call additionalTools layer on top of whatever the mode produced
   *
   * Returns undefined when no overrides apply (agent runs with its own tools).
   */
  private _buildToolsets(mode: HarnessMode, callAdditional?: ToolsInput): Record<string, ToolsInput> | undefined {
    const toolsets: Record<string, ToolsInput> = {};
    if (mode.tools) toolsets[`mode:${mode.id}`] = mode.tools;
    if (mode.additionalTools) toolsets[`mode:${mode.id}:add`] = mode.additionalTools;
    if (callAdditional) toolsets[`call:additional`] = callAdditional;
    return Object.keys(toolsets).length === 0 ? undefined : toolsets;
  }

  /**
   * Build the per-turn `RequestContext` that the agent passes to tools. The
   * `'harness'` slot exposes `HarnessRequestContext` (§6.1). Tools read it
   * with `context.requestContext.get('harness')`.
   *
   * The slot is constructed fresh per turn so identity reads, the state
   * snapshot, abort plumbing, and event emission all see the current state
   * of the session. Functional `setState` updates serialize through the
   * same `_flushUpdate` chain that backs `Session.setState`.
   */
  private _buildRequestContext(turn: { modeId: string; abortSignal: AbortSignal }): RequestContext {
    const session = this;
    const stateSnapshot = (this._record.state ?? {}) as unknown;
    const harnessSlot: HarnessRequestContext<unknown> = {
      harnessId: this._harness.ownerId,
      sessionId: this.id,
      threadId: this.threadId,
      resourceId: this.resourceId,
      modeId: turn.modeId,
      state: stateSnapshot,
      getState: () => (session._record.state ?? {}) as unknown,
      setState: ((updatesOrUpdater: unknown) => {
        if (typeof updatesOrUpdater === 'function') {
          return session.setState(updatesOrUpdater as (prev: unknown) => unknown);
        }
        return session.setState(updatesOrUpdater as Partial<unknown>);
      }) as HarnessRequestContext<unknown>['setState'],
      abortSignal: turn.abortSignal,
      emitEvent: (event: EmitInput) => {
        // Reserved-type + JSON-serialization guard runs synchronously before
        // any subscriber observes the event (§6.2).
        assertCustomEventType(event.type);
        assertJsonSerializable(event.type, session.id, event);
        session._emitTurnEvent(event);
      },
      registerQuestion: () => {
        throw new HarnessConfigError('ctx.registerQuestion', 'not implemented in this milestone');
      },
      registerPlanApproval: () => {
        throw new HarnessConfigError('ctx.registerPlanApproval', 'not implemented in this milestone');
      },
      // Subagent linkage — base session has no parent.
      subagentDepth: 0,
      source: 'parent',
      getSubagentModel: () => null,
    };
    return new RequestContext([['harness', harnessSlot]]);
  }

  /**
   * @internal — used by the Harness during `close()` and `shutdown()` to
   * mark this instance terminal. Does not touch storage or release the
   * lease — those are the harness's job. Idempotent.
   */
  _markClosed(updatedRecord: SessionRecord): void {
    this._record = updatedRecord;
    this._state = 'closed';
  }

  /**
   * @internal — used by the Harness when an idle/pressure eviction drops the
   * instance from the live map (§5.4). The record stays active in storage;
   * the session can be re-hydrated. Currently unused; lands with eviction.
   */
  _markEvicted(updatedRecord: SessionRecord): void {
    this._record = updatedRecord;
    this._state = 'evicted';
  }

  /** @internal — accessor for the Harness when it needs the owner id back. */
  get _internalOwnerId(): string {
    return this._ownerId;
  }

  /** @internal — accessor for the Harness when it needs the record version. */
  get _internalRecordVersion(): number {
    return this._record.version;
  }

  /** @internal — accessor for the Harness when it needs the storage handle. */
  get _internalStorage(): HarnessStorage {
    return this._storage;
  }
}
