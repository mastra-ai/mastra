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
import type { HarnessStorage, SessionRecord } from '../../storage/domains/harness';
import type { MastraModelOutput, FullOutput } from '../../stream/base/output';

import { HarnessConfigError } from './errors';
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
      return (result as FullOutput<unknown>).object;
    }

    // Streaming path: hand the live MastraModelOutput back.
    if (opts.stream === true) {
      const out = await agent.stream(opts.content, baseExecOptions);
      return out as MastraModelOutput<unknown>;
    }

    // Default path: stream + getFullOutput so we get a fully-resolved bundle.
    const out = await agent.stream(opts.content, baseExecOptions);
    return await out.getFullOutput();
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
      hasPendingApproval: rec.pendingApproval !== undefined,
      hasPendingSuspension: rec.pendingSuspension !== undefined,
      hasPendingQuestion: rec.pendingQuestion !== undefined,
      hasPendingPlan: rec.pendingPlan !== undefined,
      goal: rec.goal,
      lastActivityAt: rec.lastActivityAt,
    };
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
