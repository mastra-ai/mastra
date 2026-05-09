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

import type { z } from 'zod';

import type { AgentExecutionOptionsBase } from '../../agent/agent.types';
import type { ToolsInput } from '../../agent/types';
import type { HarnessStorage, PendingResume, SessionRecord } from '../../storage/domains/harness';
import type { MastraModelOutput, FullOutput } from '../../stream/base/output';

import { HarnessConfigError, HarnessValidationError } from './errors';
import type { Harness } from './harness';
import type {
  AgentResult,
  AgentStream,
  HarnessMode,
  MessageOptions,
  MessageOptionsDefault,
  MessageOptionsStream,
  MessageOptionsStructured,
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
 * Point-in-time snapshot returned by `getDisplayState()` (§4.2). Reads off
 * the in-memory `SessionRecord`; safe to call frequently from a UI event
 * loop. Pending interrupts are summarized as booleans — call the
 * dedicated `respond*` paths to inspect or resolve them.
 */
export interface SessionDisplayState {
  sessionId: string;
  threadId: string;
  resourceId: string;
  lifecycleState: SessionLifecycleState;
  modeId: string;
  modelId: string;
  queueDepth: number;
  hasPendingApproval: boolean;
  hasPendingSuspension: boolean;
  hasPendingQuestion: boolean;
  hasPendingPlan: boolean;
  goal?: SessionRecord['goal'];
  lastActivityAt: number;
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

    const baseExecOptions: AgentExecutionOptionsBase<unknown> = {
      memory: { thread: this.threadId, resource: this.resourceId },
      abortSignal: opts.abortSignal,
      ...(toolsets ? { toolsets } : {}),
      ...(mode.instructions ? { instructions: mode.instructions } : {}),
    };

    // Structured + sync path: agent.generate with structuredOutput.
    if (opts.output !== undefined && opts.sync === true) {
      const result = await agent.generate(opts.content, {
        ...baseExecOptions,
        structuredOutput: { schema: opts.output as never },
      });
      const full = result as FullOutput<unknown>;
      await this._maybeCaptureSuspend(full);
      return full.object;
    }

    // Streaming path: hand the live MastraModelOutput back. The caller drains
    // the stream; we attach a best-effort capture so a suspend that surfaces
    // mid-stream is persisted as `pendingResume` before the next `respond*`
    // call. Errors are swallowed — the caller already owns the stream.
    if (opts.stream === true) {
      const out = await agent.stream(opts.content, baseExecOptions);
      out
        .getFullOutput()
        .then(full => this._maybeCaptureSuspend(full as FullOutput<unknown>))
        .catch(() => {});
      return out as MastraModelOutput<unknown>;
    }

    // Default path: stream + getFullOutput so we get a fully-resolved bundle.
    const out = await agent.stream(opts.content, baseExecOptions);
    const full = await out.getFullOutput();
    await this._maybeCaptureSuspend(full);
    return full;
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
  async setMode(modeId: string): Promise<void> {
    this._assertLive('setMode()');
    // Validates and throws on unknown id.
    this._harness._getMode(modeId);
    if (this._record.modeId === modeId) return;
    await this._flushUpdate(prev => ({ ...prev, modeId }));
  }

  /** Switch the active model id. Free-form string — validated by the agent layer. */
  async setModel(modelId: string): Promise<void> {
    this._assertLive('setModel()');
    if (this._record.modelId === modelId) return;
    await this._flushUpdate(prev => ({ ...prev, modelId }));
  }

  // -------------------------------------------------------------------------
  // getDisplayState — §4.2.
  //
  // A point-in-time snapshot used by TUIs / Studio. Reads off the Session
  // record; doesn't touch storage. Pending interrupts are summarized as
  // simple booleans so downstream code can render badges without paging
  // the full pending payload.
  // -------------------------------------------------------------------------

  getDisplayState(): SessionDisplayState {
    this._assertLive('getDisplayState()');
    const rec = this._record;
    return {
      sessionId: this.id,
      threadId: this.threadId,
      resourceId: this.resourceId,
      lifecycleState: this._state,
      modeId: rec.modeId,
      modelId: rec.modelId,
      queueDepth: rec.pendingQueue.length,
      hasPendingApproval: rec.pendingResume?.kind === 'tool-approval',
      hasPendingSuspension: rec.pendingResume?.kind === 'tool-suspension',
      hasPendingQuestion: rec.pendingResume?.kind === 'question',
      hasPendingPlan: rec.pendingResume?.kind === 'plan-approval',
      goal: rec.goal,
      lastActivityAt: rec.lastActivityAt,
    };
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
  async respondToolApproval(opts: { approved: boolean }): Promise<AgentResult> {
    return this._resume('tool-approval', { approved: opts.approved });
  }

  /** Resume a pending tool-suspension. `resumeData` is forwarded to the tool. */
  async respondToolSuspension(opts: { resumeData: unknown }): Promise<AgentResult> {
    return this._resume('tool-suspension', opts.resumeData);
  }

  /** Resume a pending `ask_user` question. */
  async respondToolQuestion(opts: { answer: unknown }): Promise<AgentResult> {
    return this._resume('question', { answer: opts.answer });
  }

  /**
   * Resume a pending `submit_plan` approval. On `approved: true` the harness
   * also flips the active mode if the submitting mode declared `transitionsTo`,
   * recording the flip via `approvedTransitionModeId` /
   * `modeTransitionAppliedAt` for idempotent replay.
   */
  async respondPlanApproval(opts: { approved: boolean; feedback?: string }): Promise<AgentResult> {
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

    const agent = this._harness.getAgentForMode(this._record.modeId);
    const out = await agent.resumeStream(resumeData, {
      runId: pending.runId,
      toolCallId: pending.toolCallId,
    });
    const full = (await out.getFullOutput()) as FullOutput<unknown>;

    // Clear pending + apply mode flip in a single CAS write. The mode flip
    // and pending-clear must land together so a replay does not see
    // "pending cleared, mode not yet flipped" or vice versa.
    await this._flushUpdate(prev => {
      const next: SessionRecord = { ...prev };
      delete next.pendingResume;
      if (modeFlipTarget) next.modeId = modeFlipTarget;
      return next;
    });

    // The resumed run can itself suspend again (multi-step approval chains).
    // Mirror message()'s post-run hook so the next respond* call sees the
    // new pending record.
    await this._maybeCaptureSuspend(full);
    return full as AgentResult;
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
  private async _flushUpdate(update: (prev: SessionRecord) => SessionRecord): Promise<void> {
    const next: SessionRecord = {
      ...update(this._record),
      lastActivityAt: Date.now(),
    };
    const saved = await this._storage.saveSession(next, {
      ownerId: this._ownerId,
      ifVersion: this._record.version,
    });
    this._record = { ...next, version: saved.version };
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
