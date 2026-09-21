/**
 * Harness v1 — error taxonomy.
 *
 * One file for the whole catalog. Every error name maps 1:1 to a wire code
 * in the discriminated `HarnessErrorResponse` union (§13.2). See HARNESS_V1_SPEC.md
 * §4.5 for the complete list and rationale; this file currently carries the
 * subset needed by lifecycle/resolver code, and grows as the rest of the
 * surface lands.
 */

/**
 * Shared base for every harness error that carries a public, namespaced
 * `harness.*` wire `code`. Membership is by INSTANCE: the public-error
 * projection (`projectHarnessPublicError`, §13.3f.1) trusts `err instanceof
 * HarnessError` to pass `code` + `message` through unredacted, instead of
 * trusting an arbitrary `.code` string (which a forged/raw error could spoof to
 * leak a driver/SQL/path message across the wire).
 *
 * Each subclass keeps declaring its own `readonly code = 'harness.xxx'` literal
 * — the abstract `code` here only forces that declaration to exist; it does not
 * change any subclass's name, code, message, or fields.
 *
 * `HarnessStorageError` deliberately does NOT extend this base: it carries no
 * `code` field and projects to the fixed `harness.storage` code via its own
 * branch, keeping its raw `cause` local-only.
 */
export abstract class HarnessError extends Error {
  abstract readonly code: string;
}

/**
 * Misconfiguration detected at `new Harness(config)`. Examples: a `HarnessMode`
 * references an unknown agent id; both `tools` and `additionalTools` set on
 * the same mode; `defaultModeId` does not match any mode.
 */
export class HarnessConfigError extends Error {
  readonly name = 'HarnessConfigError';
  constructor(
    public readonly field: string,
    public readonly reason: string,
  ) {
    super(`HarnessConfigError at ${field}: ${reason}`);
  }
}

/**
 * Ref kinds that can be missing or drifted at hydration / background-task
 * execution (spec §4.5b). Generation drift is carried via
 * `expectedGeneration` / `actualGeneration` on a drifted ref, not as its own
 * kind.
 */
export type HarnessRuntimeDriftRefKind =
  | 'mode'
  | 'agent'
  | 'model'
  | 'tool'
  | 'mcp_binding'
  | 'workspace_provider'
  | 'executor'
  | 'completion_policy'
  | 'sandbox_policy'
  | 'channel';

export interface HarnessRuntimeMissingRef {
  kind: HarnessRuntimeDriftRefKind;
  ref: string;
}

export interface HarnessRuntimeDriftedRef {
  kind: HarnessRuntimeDriftRefKind;
  ref: string;
  expectedGeneration?: string;
  actualGeneration?: string;
}

export interface HarnessRuntimeDriftDetails {
  sessionId?: string;
  runId?: string;
  backgroundTaskId?: string;
  missingRefs?: HarnessRuntimeMissingRef[];
  driftedRefs?: HarnessRuntimeDriftedRef[];
  /** Human-readable cause used in the Error message only; not a wire field. */
  context?: string;
}

/**
 * Thrown when hydration or background-task execution observes that stored
 * runtime dependency identifiers (mode, agent, model, tool, mcp binding,
 * workspace provider, executor, completion policy, sandbox policy, channel)
 * are missing or have a `runtimeCompatibilityGeneration` mismatch versus the
 * current runtime configuration. Spec §4.5b.
 *
 * Wire projection (§13.3f.1) is `harness.runtime_drift` with
 * `details.missingRefs` / `details.driftedRefs`. The bare storage-row cause
 * code is `runtime_dependency_drifted` (`HarnessRowErrorCode`, §4.5d).
 */
export class HarnessRuntimeDriftError extends HarnessError {
  readonly name = 'HarnessRuntimeDriftError';
  readonly code = 'harness.runtime_drift';
  readonly sessionId?: string;
  readonly runId?: string;
  readonly backgroundTaskId?: string;
  readonly missingRefs?: HarnessRuntimeMissingRef[];
  readonly driftedRefs?: HarnessRuntimeDriftedRef[];
  /** Human-readable cause context; not part of the public wire detail. */
  readonly context?: string;

  constructor(details: HarnessRuntimeDriftDetails) {
    super(HarnessRuntimeDriftError._message(details));
    this.sessionId = details.sessionId;
    this.runId = details.runId;
    this.backgroundTaskId = details.backgroundTaskId;
    this.missingRefs = details.missingRefs;
    this.driftedRefs = details.driftedRefs;
    this.context = details.context;
  }

  private static _message(d: HarnessRuntimeDriftDetails): string {
    const parts: string[] = [];
    for (const m of d.missingRefs ?? []) {
      parts.push(`${m.kind} "${m.ref}" is not registered`);
    }
    for (const r of d.driftedRefs ?? []) {
      const gen =
        r.expectedGeneration !== undefined || r.actualGeneration !== undefined
          ? ` (recorded generation "${r.expectedGeneration ?? 'unset'}", current "${r.actualGeneration ?? 'unset'}")`
          : '';
      parts.push(`${r.kind} "${r.ref}" drifted${gen}`);
    }
    const base = parts.length ? `Runtime dependency drift: ${parts.join('; ')}` : 'Runtime dependency drift';
    return d.context ? `${base} during ${d.context}` : base;
  }
}

/**
 * `harness.session({ sessionId })` could not find a record, or `{ sessionId,
 * resourceId }` found one whose `resourceId` did not match. Existence across
 * tenants is never leaked — a foreign-owned session surfaces as not-found.
 */
export class HarnessSessionNotFoundError extends Error {
  readonly name = 'HarnessSessionNotFoundError';
  constructor(public readonly sessionId: string) {
    super(`Session "${sessionId}" not found`);
  }
}

/**
 * Direct ID lookup of a closed session. Threads can be reused (`{ threadId,
 * resourceId }` ignores closed records and creates fresh), but ID lookups of
 * closed records always fail loudly.
 */
export class HarnessSessionClosedError extends Error {
  readonly name = 'HarnessSessionClosedError';
  constructor(public readonly sessionId: string) {
    super(`Session "${sessionId}" is closed`);
  }
}

/**
 * Thrown by `harness.session(...)` when hydrating or creating another session
 * would exceed `sessions.maxLive` and every live session is pinned (parked on a
 * pending interaction) or otherwise unflushable, so no pressure-eviction victim
 * is available. Spec §5.4 / §4.5b.
 */
export class HarnessLiveSessionLimitError extends HarnessError {
  readonly name = 'HarnessLiveSessionLimitError';
  readonly code = 'harness.live_session_limit';
  constructor(
    public readonly maxLive: number,
    public readonly liveCount: number,
  ) {
    super(`Live session limit reached (maxLive ${maxLive}, live ${liveCount}); all live sessions are pinned`);
  }
}

/**
 * The session has entered the durable closing phase. The record still
 * occupies its active `(harnessName, resourceId, threadId)` key while close
 * aborts/drains live work and cascades through descendants, but callers must
 * not start new work or mutate session state.
 */
export class HarnessSessionClosingError extends Error {
  readonly name = 'HarnessSessionClosingError';
  constructor(
    public readonly sessionId: string,
    public readonly closingAt: number,
    public readonly closeDeadlineAt: number,
  ) {
    super(`Session "${sessionId}" is closing (deadline ${new Date(closeDeadlineAt).toISOString()})`);
  }
}

/**
 * Build a `HarnessSessionClosingError` (§4.5b) from any source that carries the
 * closing window — a live `Session`, a stored `SessionRecord`, or an explicit
 * `{ id, closingAt?, closeDeadlineAt? }`.
 *
 * A genuinely-closing *persisted* source has both timestamps. But several
 * callers throw the moment close *starts* — `Session._beginClosing()` flips the
 * state and rejects idle waiters before the durable closing marker (which sets
 * `closingAt`/`closeDeadlineAt`) is committed, and `_assertLive`/the admission
 * path gate on the in-memory `isClosing` flag for the same reason. At those
 * points the timestamps are legitimately still `undefined`.
 *
 * Fallback semantics (kept explicit on purpose; this is NOT a synthesized
 * grace window):
 * - Missing `closingAt` falls back to "now": the session has begun closing as
 *   of this throw, even though the persisted marker has not landed yet.
 * - Missing `closeDeadlineAt` falls back to `closingAt`, i.e. an *immediate*
 *   deadline with zero remaining grace. This is the conservative choice for
 *   retry clamping / dead-letter decisions — consumers must not assume more
 *   time than is actually known. It deliberately does not invent a grace
 *   window (e.g. via a default `closeTimeoutMs`), since the real deadline is
 *   only knowable once `_flushClosingMarker` persists it.
 */
export function harnessSessionClosingError(source: {
  id: string;
  closingAt?: number;
  closeDeadlineAt?: number;
}): HarnessSessionClosingError {
  const closingAt = source.closingAt ?? Date.now();
  const closeDeadlineAt = source.closeDeadlineAt ?? closingAt;
  return new HarnessSessionClosingError(source.id, closingAt, closeDeadlineAt);
}

/**
 * Raised when a queued turn or pending resume is rejected because the session
 * or a specific queue item was cancelled before the work completed.
 */
export class HarnessSessionCancelledError extends HarnessError {
  readonly name = 'HarnessSessionCancelledError';
  readonly code = 'harness.session_cancelled';

  constructor(
    public readonly sessionId: string,
    public readonly reason?: string,
  ) {
    super(reason ? `Session "${sessionId}" cancelled: ${reason}` : `Session "${sessionId}" cancelled`);
  }
}

export interface HarnessSessionDeleteBlocker {
  source:
    | 'session'
    | 'child_session'
    | 'queue'
    | 'inbox_response'
    | 'channel_binding'
    | 'channel_inbox'
    | 'channel_action'
    | 'channel_outbox'
    | 'wakeup'
    | 'attachment'
    | 'workspace';
  id?: string;
  status?: string;
}

export class HarnessSessionDeleteBlockedError extends Error {
  readonly name = 'HarnessSessionDeleteBlockedError';
  constructor(
    public readonly sessionId: string,
    public readonly blockers: ReadonlyArray<HarnessSessionDeleteBlocker>,
  ) {
    super(`Session "${sessionId}" cannot be deleted: ${blockers.length} blocker(s)`);
  }
}

export class HarnessSessionDeletedError extends Error {
  readonly name = 'HarnessSessionDeletedError';
  readonly resourceId?: string;
  readonly threadId?: string;
  constructor(
    public readonly sessionId: string,
    resourceId?: string,
    threadId?: string,
  ) {
    super(`Session "${sessionId}" is deleted`);
    this.resourceId = resourceId;
    this.threadId = threadId;
  }
}

export type HarnessSessionCorruptReason =
  | 'parse_failed'
  | 'schema_incompatible'
  | 'duplicate_session_owner'
  | 'pending_state_corrupt'
  | 'tool_surface_unrehydratable';

/**
 * The harness observed a stored session record that violates a storage
 * invariant — e.g. a direct-ID record whose `(harnessName, resourceId,
 * threadId)` now has a *different* current owner (`duplicate_session_owner`),
 * an unparseable/`schema_incompatible` row, or unrehydratable pending/tool
 * state. Fails closed before acquiring or stealing a lease. Spec §4.5d / §5.2a.
 */
export class HarnessSessionCorruptError extends HarnessError {
  readonly name = 'HarnessSessionCorruptError';
  readonly code = 'harness.session_corrupt';
  readonly reason: HarnessSessionCorruptReason;
  readonly sessionId?: string;
  readonly resourceId?: string;
  readonly threadId?: string;
  readonly ownerSessionIds?: string[];
  constructor(details: {
    reason: HarnessSessionCorruptReason;
    sessionId?: string;
    resourceId?: string;
    threadId?: string;
    ownerSessionIds?: string[];
  }) {
    super(
      `Session record corrupt (${details.reason})` + (details.sessionId ? ` for session "${details.sessionId}"` : ''),
    );
    this.reason = details.reason;
    this.sessionId = details.sessionId;
    this.resourceId = details.resourceId;
    this.threadId = details.threadId;
    this.ownerSessionIds = details.ownerSessionIds;
  }
}

/**
 * §4.5 / §2.2: thrown when resolving a specific `sessionId` for a
 * `(harnessName, resourceId, threadId)` pair that already has a DIFFERENT current
 * owner. Harness v1 permits only one current owner per harness/thread/resource
 * across Active, Closing, and Closed-reopenable records, so requesting a
 * superseded session id is an expected CONFLICT (resolve `activeSessionId`
 * instead) — distinct from `HarnessSessionCorruptError` ('duplicate_session_owner'),
 * which is reserved for two genuinely-active owners on one thread.
 */
export class HarnessSessionConflictError extends HarnessError {
  readonly name = 'HarnessSessionConflictError';
  readonly code = 'harness.session_conflict';
  constructor(
    public readonly resourceId: string,
    public readonly threadId: string,
    public readonly requestedSessionId: string,
    public readonly activeSessionId: string,
  ) {
    super(
      `Session "${requestedSessionId}" is not the current owner of thread "${threadId}" ` +
        `(resource "${resourceId}"); the active owner is "${activeSessionId}"`,
    );
  }
}

export type HarnessAbortReason = 'agent_aborted' | 'parent_aborted' | 'session_closed' | 'process_restart';

/**
 * §4.5c / §6.2: the `reason` carried by a turn's `abortSignal.reason`. The harness
 * selects the reason from the abort SOURCE (not a caller-supplied string):
 * `agent_aborted` for ordinary `session.abort()`/cancel, `parent_aborted` when a
 * parent run's abort propagates into a live subagent turn (carries the
 * `parentSessionId`), `session_closed` for the close lifecycle, `process_restart`
 * for live process shutdown/eviction. Tools branch on `reason` to decide rollback
 * vs best-effort cleanup. Wire code `harness.aborted` (§13.3).
 */
export class HarnessAbortedError extends HarnessError {
  readonly name = 'HarnessAbortedError';
  readonly code = 'harness.aborted';
  constructor(
    public readonly sessionId: string,
    public readonly reason: HarnessAbortReason,
    public readonly parentSessionId?: string,
  ) {
    super(
      `Session "${sessionId}" aborted (${reason})` +
        (parentSessionId !== undefined ? `; parent "${parentSessionId}"` : ''),
    );
  }
}

export type HarnessOutputGenerationReason =
  | 'structured_output_validation_failed'
  | 'structured_output_missing_object'
  | 'tripwire'
  | 'interactive_tool_required'
  | 'model_error';

/**
 * §4.5 / §13.3 (`harness.output_generation_failed`): thrown by the schema-bearing
 * sync generate form — `message({ output, sync: true })` — after the run starts
 * when the model/runtime cannot produce a successful public typed value. This is
 * not an admission-id conflict and does not create retry-safe result evidence in
 * v1. `tripwire` means an output processor rejected the response; `model_error`
 * wraps an opaque generation/runtime failure from the agent layer (aborts and
 * harness-domain errors pass through untouched).
 */
export class HarnessOutputGenerationError extends HarnessError {
  readonly name = 'HarnessOutputGenerationError';
  readonly code = 'harness.output_generation_failed';
  constructor(
    public readonly sessionId: string,
    public readonly reason: HarnessOutputGenerationReason,
    public readonly runId?: string,
    options?: { cause?: unknown },
  ) {
    super(`Structured output generation failed for session "${sessionId}" (${reason})`, options);
  }
}

/**
 * Generic, already-redacted wrapper for a raw provider/model/runtime execution
 * failure that crosses a public §4.2b boundary (e.g. the value REJECTED from
 * `session.message()` / `session.signal()` / `session.skills.use()`, which
 * delegate to `message()`). §13.3f.1 forbids raw driver/SQL/path/`err.message`
 * text from crossing any public Harness boundary, and SDK promise rejections
 * are explicitly listed among those boundaries (§13.3f).
 *
 * Behaves exactly like the {@link HarnessStorageError} both-satisfying shape:
 * - its public `.message` is a fixed, construction-safe summary (so a naive
 *   caller that surfaces `.message` — e.g. `spawn-subagent-tool` projecting a
 *   child failure into its tool result — cannot leak provider detail), and
 * - the raw original is kept LOCAL-ONLY on `.cause` so the trusted Doxa caller
 *   retains full fidelity for logging / retry classification.
 *
 * It maps to the reserved `harness.internal` wire code via {@link HarnessError},
 * which is exactly what `projectHarnessPublicError` already produces for an
 * un-typed raw error — so wire/event/durable surfaces stay byte-identical; only
 * the in-process promise rejection changes (from raw to redacted). Harness-own
 * errors (`HarnessError` / `HarnessStorageError`) are construction-safe by
 * design and are NEVER wrapped — they pass through with their own typed message.
 */
export class HarnessExecutionError extends HarnessError {
  readonly name = 'HarnessExecutionError';
  readonly code = 'harness.internal';
  /** The raw underlying provider/model/runtime error. LOCAL-ONLY; never projected to the wire. */
  readonly cause: unknown;
  constructor(cause: unknown) {
    // Fixed, redacted message — must match the public `harness.internal`
    // projection (`HARNESS_INTERNAL_REDACTED_MESSAGE` in events.ts) so a caller
    // surfacing `.message` sees the same generic text the wire surface carries.
    super('An internal harness error occurred');
    this.cause = cause;
  }
}

/**
 * True for a value that is one of the Harness's OWN error classes. Every such
 * class (see this file) declares a `readonly name = 'Harness…'` and builds its
 * `.message` from known, non-sensitive fields — so its message is
 * construction-safe and never carries raw driver/SQL/path text. They do NOT all
 * share a single base (`HarnessError` is only the wire-`code`-bearing subset;
 * many extend `Error` directly), so the recognizer is the shared `name`
 * prefix.
 *
 * Why name-prefix (not strict per-class instanceof, unlike the WIRE projection
 * `projectHarnessPublicError`): this predicate gates the IN-PROCESS promise
 * rejection consumed by the TRUSTED in-VM caller (Doxa), which branches on the
 * concrete Harness error TYPE. The wire projection trusts by instance because a
 * forged `code` string could leak across an UNtrusted boundary; here the
 * consumer is in-process and the only realistic risk is accidentally redacting
 * a genuine Harness-typed error (which a raw provider/storage error never
 * impersonates by setting `name = 'Harness…'`).
 */
function isHarnessOwnError(err: unknown): boolean {
  return err instanceof Error && typeof (err as { name?: unknown }).name === 'string' && err.name.startsWith('Harness');
}

/**
 * Redact a value about to REJECT a public §4.2b op (`message()` / `signal()` /
 * `skills.use()`), enforcing §13.3f.1 on the in-process promise-rejection
 * boundary. A value that is already a construction-safe Harness-own error
 * (any `Harness…Error`, including `HarnessError` / `HarnessStorageError`)
 * passes through UNCHANGED — callers rely on its concrete type/message.
 * Anything else (a raw provider/runtime/storage `Error`, `MastraError`, or
 * non-Error throw) is wrapped in a {@link HarnessExecutionError} whose
 * `.message` is redacted and whose `.cause` keeps the raw original local-only.
 */
export function redactPublicBoundaryRejection(err: unknown): unknown {
  if (isHarnessOwnError(err)) return err;
  return new HarnessExecutionError(err);
}

/**
 * `harness.session(...)` could not acquire the session's write lease under
 * `lockMode: 'fail'`. Carries the current owner so callers can route the
 * request to the holding instance, and the TTL so callers can decide whether
 * to back off and retry. See §5.8.
 */
export class HarnessSessionLockedError extends Error {
  readonly name = 'HarnessSessionLockedError';
  constructor(
    public readonly sessionId: string,
    public readonly currentOwnerId: string,
    public readonly expiresAt: number,
  ) {
    super(`Session "${sessionId}" is locked by owner "${currentOwnerId}" until ${new Date(expiresAt).toISOString()}`);
  }
}

/**
 * Caller passed an option that violates a runtime contract — e.g.
 * `respondToToolApproval` while no `tool-approval` is pending, or while a
 * different `kind` of resume is pending. Throws synchronously before any
 * agent or storage work happens.
 */
export class HarnessValidationError extends Error {
  readonly name = 'HarnessValidationError';
  constructor(
    public readonly field: string,
    public readonly reason: string,
  ) {
    super(`HarnessValidationError at ${field}: ${reason}`);
  }
}

export type HarnessBusyReason =
  | 'in_flight'
  | 'pending_approval'
  | 'pending_suspension'
  | 'pending_question'
  | 'pending_plan';

/**
 * Thrown by the fail-fast forms — `message({ sync: true, output })` and
 * `session.skills.use(...)` — when the session is busy (a run is in flight or a
 * pending interaction is open). These forms need a clean turn boundary; the
 * default `message()` / `signal()` / `queue()` paths are busy-independent and
 * never throw this. Spec §3 / §4.4a.
 */
export class HarnessBusyError extends HarnessError {
  readonly name = 'HarnessBusyError';
  readonly code = 'harness.busy';
  constructor(
    public readonly sessionId: string,
    public readonly reason: HarnessBusyReason,
  ) {
    super(`Session "${sessionId}" is busy (${reason})`);
  }
}

/**
 * `session.queue(...)` rejected at admission because `pendingQueue` has
 * already reached `sessions.maxQueueDepth` (default 100). The capacity check
 * and durable append are atomic per session, so two concurrent `queue()`
 * calls cannot both observe available space and commit past the cap.
 */
export class HarnessQueueFullError extends Error {
  readonly name = 'HarnessQueueFullError';
  constructor(
    public readonly sessionId: string,
    public readonly maxQueueDepth: number,
    public readonly currentDepth: number,
  ) {
    super(`Queue for session "${sessionId}" is full (max ${maxQueueDepth}, current ${currentDepth})`);
  }
}

export class HarnessQueueItemExpiredError extends HarnessError {
  readonly name = 'HarnessQueueItemExpiredError';
  readonly code = 'harness.queue_item_expired';

  constructor(
    public readonly sessionId: string,
    public readonly queuedItemId: string,
    public readonly deadline: number,
  ) {
    super(`Queued item "${queuedItemId}" for session "${sessionId}" expired at ${new Date(deadline).toISOString()}`);
  }
}

/**
 * Thrown by a `sessions.onBeforeQueuedTurn` hook to defer the selected queue
 * head without failing it: the item stays in `pendingQueue`, its resolver
 * remains pending, and the drain retries at `retryAt`. Use for transient
 * pre-drain reconciliation failures (durable store reads, lease probes). Any
 * other error thrown by the hook fails the item permanently through the
 * normal queue-failure path instead.
 */
export class HarnessQueuedTurnDeferredError extends HarnessError {
  readonly name = 'HarnessQueuedTurnDeferredError';
  readonly code = 'harness.queued_turn_deferred';
  /** Epoch ms at which the drain should re-attempt the queued item. */
  readonly retryAt: number;
  /** Original failure the hook deferred on; kept for diagnostics only. */
  readonly deferredCause: unknown;

  constructor(opts: { retryAt: number; cause?: unknown }) {
    super('queued turn deferred by the pre-drain hook');
    if (!Number.isFinite(opts.retryAt)) {
      // NaN/Infinity would collapse the park timer to an immediate re-drain
      // hot loop; a malformed deferral is a hook bug and must fail the item.
      throw new RangeError('HarnessQueuedTurnDeferredError.retryAt must be a finite epoch-millisecond timestamp');
    }
    this.retryAt = opts.retryAt;
    this.deferredCause = opts.cause;
  }
}

/**
 * A durable user interaction reached its deadline before any response won the
 * session CAS. The session remains usable for future turns; only the suspended
 * run is terminalized.
 */
export class HarnessPendingInteractionExpiredError extends HarnessError {
  readonly name = 'HarnessPendingInteractionExpiredError';
  readonly code = 'harness.pending_interaction_expired';

  constructor(
    public readonly sessionId: string,
    public readonly itemId: string,
    public readonly expiresAt: number,
  ) {
    super(`Pending interaction "${itemId}" for session "${sessionId}" expired at ${new Date(expiresAt).toISOString()}`);
  }
}

export class HarnessAdmissionConflictError extends Error {
  readonly name = 'HarnessAdmissionConflictError';
  constructor(
    public readonly sessionId: string,
    public readonly admissionId: string,
    public readonly storedAdmissionHash: string,
    public readonly attemptedAdmissionHash: string,
  ) {
    super(`Admission "${admissionId}" for session "${sessionId}" conflicts with stored evidence`);
  }
}

export class HarnessInboxItemNotFoundError extends Error {
  readonly name = 'HarnessInboxItemNotFoundError';
  constructor(
    public readonly sessionId: string,
    public readonly itemId: string,
    /** The pending kind the caller was responding to, when known (§4.5a). */
    public readonly kind?: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval',
  ) {
    super(`Inbox item "${itemId}" for session "${sessionId}" was not found`);
  }
}

export class HarnessInboxResponseConflictError extends Error {
  readonly name = 'HarnessInboxResponseConflictError';
  constructor(
    public readonly sessionId: string,
    public readonly itemId: string,
    public readonly responseId: string,
  ) {
    super(
      `Inbox response "${responseId}" for item "${itemId}" on session "${sessionId}" conflicts with stored evidence`,
    );
  }
}

export class HarnessStateConflictError extends Error {
  readonly name = 'HarnessStateConflictError';
  constructor(
    public readonly sessionId: string,
    public readonly attemptedVersion: number,
    public readonly currentVersion: number,
  ) {
    super(`State update for session "${sessionId}" expected version ${attemptedVersion} but found ${currentVersion}`);
  }
}

/**
 * §4.5 / §5.1: thrown BEFORE any durable state commit when a candidate
 * `session.state` cannot round-trip through `JSON.stringify` / `JSON.parse` as
 * plain JSON (e.g. a function, symbol, bigint, `undefined`, non-finite number,
 * circular reference, or a non-plain object like `Date`/`Map`/`Set`/class
 * instance). This is a non-retryable state-SHAPE failure, not a storage failure
 * (adapter/save failures after validation surface as `HarnessStorageError`).
 * `path` is a dotted path into `state` (`$` for the root).
 */
export class HarnessStateSerializationError extends Error {
  readonly name = 'HarnessStateSerializationError';
  constructor(
    public readonly sessionId: string,
    public readonly path: string,
  ) {
    super(`State for session "${sessionId}" is not JSON-serializable at path "${path}"`);
  }
}

export class HarnessAttachmentInUseError extends Error {
  readonly name = 'HarnessAttachmentInUseError';
  constructor(
    public readonly sessionId: string,
    public readonly attachmentId: string,
    public readonly references: ReadonlyArray<{ source: string; sourceId: string; retainedUntil?: number }>,
  ) {
    super(`Attachment "${attachmentId}" for session "${sessionId}" is still in use`);
  }
}

export type HarnessAttachmentUnavailableReason =
  | 'not_found'
  | 'fetch_failed'
  | 'fetch_timeout'
  | 'too_large'
  | 'mime_mismatch'
  | 'digest_mismatch'
  | 'unsupported_url'
  | 'redirect_limit_exceeded'
  | 'network_target_blocked'
  | 'blocked_by_policy';

export class HarnessAttachmentUnavailableError extends Error {
  readonly name = 'HarnessAttachmentUnavailableError';
  constructor(
    public readonly sessionId: string,
    public readonly reason: HarnessAttachmentUnavailableReason,
    public readonly attachmentId?: string,
  ) {
    super(`Attachment${attachmentId ? ` "${attachmentId}"` : ''} for session "${sessionId}" is unavailable: ${reason}`);
  }
}

/**
 * `spawn_subagent` called from a session whose `subagentDepth` is at or
 * above `HarnessConfig.subagents.maxDepth`. Surfaces as a tool error
 * payload (not a thrown exception) so the parent agent can recover and
 * continue without aborting the whole turn.
 */
export class HarnessSubagentDepthExceededError extends Error {
  readonly name = 'HarnessSubagentDepthExceededError';
  constructor(
    public readonly maxDepth: number,
    public readonly attemptedDepth: number,
  ) {
    super(`Cannot spawn a subagent: attempted depth ${attemptedDepth} exceeds maxDepth ${maxDepth}`);
  }
}

/**
 * A parent session attempted to start more inline or durable subagent work than
 * `HarnessConfig.subagents.maxConcurrent` permits. Both `spawn_subagent` and
 * `task_delegate` consume the same parent-local reservation, so choosing the
 * detached API cannot bypass backpressure.
 */
export class HarnessSubagentConcurrencyLimitError extends Error {
  readonly name = 'HarnessSubagentConcurrencyLimitError';
  constructor(
    public readonly maxConcurrent: number,
    public readonly inFlight: number,
  ) {
    super(`Subagent concurrency limit reached (maxConcurrent ${maxConcurrent}, in flight ${inFlight})`);
  }
}

/**
 * Durable write rejected by the storage adapter — exhausted the harness's
 * one transparent retry. `cause` carries the underlying storage error.
 */
/** Logical storage surfaces a `HarnessStorageError` can name (§4.5d). */
export type HarnessStorageOperation =
  | 'session_create'
  | 'session_load'
  | 'session_save'
  | 'session_list'
  | 'session_close'
  | 'session_delete'
  | 'session_delete_cleanup'
  | 'session_lease_acquire'
  | 'session_lease_renew'
  | 'session_lease_release'
  | 'thread'
  | 'thread_metadata'
  | 'message_log'
  | 'queue'
  | 'operation_tombstone'
  | 'inbox_response'
  | 'channel_binding'
  | 'provider_callback_binding'
  | 'channel_inbox'
  | 'channel_action'
  | 'channel_outbox'
  | 'wakeup'
  | 'attachment'
  | 'session_event_append'
  | 'workspace_cleanup';

/** The known, tenant-checked row a storage error is scoped to (§4.5d). */
export type HarnessStorageSubject =
  | { kind: 'session'; id: string }
  | { kind: 'thread'; id: string }
  | { kind: 'message'; id: string }
  | { kind: 'queued_item'; id: string }
  | { kind: 'operation_tombstone'; id: string }
  | { kind: 'inbox_response'; id: string }
  | { kind: 'channel_binding'; id: string }
  | { kind: 'provider_callback_binding'; id: string }
  | { kind: 'channel_inbox'; id: string }
  | { kind: 'channel_action'; id: string }
  | { kind: 'channel_outbox'; id: string }
  | { kind: 'wakeup'; id: string }
  | { kind: 'attachment'; id: string }
  // §4.5d: the per-resource workspace row a `workspace_cleanup` failure is
  // scoped to. Without this kind a `workspace_cleanup` storage error could not
  // name its subject, despite the operation being part of HarnessStorageOperation.
  | { kind: 'workspace'; id: string };

export class HarnessStorageError extends Error {
  readonly name = 'HarnessStorageError';
  readonly operation: HarnessStorageOperation;
  readonly cause: unknown;
  readonly retryable: boolean;
  readonly sessionId?: string;
  readonly resourceId?: string;
  readonly threadId?: string;
  readonly harnessName?: string;
  readonly channelId?: string;
  readonly subject?: HarnessStorageSubject;
  constructor(opts: {
    operation: HarnessStorageOperation;
    cause: unknown;
    retryable?: boolean;
    sessionId?: string;
    resourceId?: string;
    threadId?: string;
    harnessName?: string;
    channelId?: string;
    subject?: HarnessStorageSubject;
  }) {
    super(`Harness storage ${opts.operation} failed${opts.sessionId ? ` for session "${opts.sessionId}"` : ''}`);
    this.operation = opts.operation;
    this.cause = opts.cause;
    this.retryable = opts.retryable ?? true;
    this.sessionId = opts.sessionId;
    this.resourceId = opts.resourceId;
    this.threadId = opts.threadId;
    this.harnessName = opts.harnessName;
    this.channelId = opts.channelId;
    this.subject = opts.subject;
  }
}

/**
 * Thread CRUD operation targeted a thread that does not exist, or that
 * belongs to a different resource than the caller. Cross-resource existence
 * is never leaked — both cases produce the same error.
 */
export class HarnessThreadNotFoundError extends Error {
  readonly name = 'HarnessThreadNotFoundError';
  constructor(
    public readonly resourceId: string,
    public readonly threadId: string,
  ) {
    super(`Thread "${threadId}" not found for resource "${resourceId}"`);
  }
}

/**
 * `harness.models.*` lookup targeted a `modelId` that is not present in
 * the configured catalog ({@link HarnessConfigCommon.models}). Catalog
 * membership is a hard precondition so typos surface immediately rather
 * than silently resolving to `'unknown'` auth status.
 */
export class HarnessModelNotFoundError extends Error {
  readonly name = 'HarnessModelNotFoundError';
  constructor(public readonly modelId: string) {
    super(`Model "${modelId}" is not present in the harness model catalog`);
  }
}

/**
 * `session.skills.use(ref)` could not resolve `ref` in the session's skill
 * catalogues. `searchedSources` reports which catalogues were available for
 * lookup before giving up. See spec §4.6.
 */
export class HarnessSkillNotFoundError extends Error {
  readonly name = 'HarnessSkillNotFoundError';
  constructor(
    public readonly skillName: string,
    public readonly searchedSources: ReadonlyArray<'code-registered' | 'workspace'>,
  ) {
    super(`Skill "${skillName}" not found (searched: ${searchedSources.join(', ') || 'none'})`);
  }
}

/**
 * `session.skills.use(ref, { args })` failed args validation against the
 * resolved skill's declared schema. See spec §4.6.
 */
export class HarnessSkillArgsValidationError extends Error {
  readonly name = 'HarnessSkillArgsValidationError';
  constructor(
    public readonly skillName: string,
    public readonly issues: ReadonlyArray<string>,
  ) {
    super(`Skill "${skillName}" args invalid: ${issues.join('; ')}`);
  }
}

/**
 * A per-turn override (e.g. `mode`, `additionalTools`) was supplied on a
 * signal that drains into an already-active run. The active run's surface
 * (model/mode/toolset) was committed when the run started and cannot be
 * changed mid-flight; silently ignoring the override would be a footgun,
 * so the harness rejects at admission. See spec §4.2.
 */
export type HarnessOverrideConflictField = 'model' | 'mode' | 'addTools' | 'yolo';

export class HarnessOverrideConflictError extends HarnessError {
  readonly name = 'HarnessOverrideConflictError';
  readonly code = 'harness.override_conflict';
  constructor(
    public readonly sessionId: string,
    public readonly activeRunId: string,
    public readonly conflictingFields: HarnessOverrideConflictField[],
    message?: string,
  ) {
    super(
      message ??
        `Cannot override ${conflictingFields.join(', ')} on a signal that drains into active run "${activeRunId}" (session "${sessionId}")`,
    );
  }
}

/**
 * A harness-event publish path received a payload that is not
 * JSON-serializable. The check runs synchronously before any subscriber
 * observes the event, so in-process listeners and remote/SSE subscribers
 * see the same contract.
 *
 * `path` is the dotted location of the offending value (e.g. `event.foo.bar`).
 * `reason` is a typed description of why the value was rejected.
 */
export type EventSerializationReason =
  | 'function'
  | 'symbol'
  | 'bigint'
  | 'undefined'
  | 'class-instance'
  | 'map'
  | 'set'
  | 'date'
  | 'typed-array'
  | 'cyclic'
  | 'unknown';

export class HarnessEventSerializationError extends Error {
  readonly name = 'HarnessEventSerializationError';
  constructor(
    public readonly sessionId: string | undefined,
    public readonly eventType: string,
    public readonly path: string,
    public readonly reason: EventSerializationReason,
  ) {
    super(
      `Event "${eventType}" is not JSON-serializable at ${path}: ${reason}` +
        (sessionId ? ` (session: ${sessionId})` : ''),
    );
  }
}

/**
 * Stored `SessionRecord.workspace.providerId` does not match the harness's
 * configured workspace provider. Common when redeploying with a different
 * provider. The harness refuses to rehydrate the record rather than hand it
 * to the wrong implementation. See §2.7.
 */
export class HarnessWorkspaceProviderMismatchError extends Error {
  readonly name = 'HarnessWorkspaceProviderMismatchError';
  constructor(
    public readonly sessionId: string,
    public readonly configuredProviderId: string,
    public readonly storedProviderId: string,
  ) {
    super(
      `Workspace provider mismatch for session "${sessionId}": stored "${storedProviderId}", configured "${configuredProviderId}"`,
    );
  }
}

/**
 * A `per-session` workspace backed by a non-resumable provider could not be
 * recovered after a process restart. The next tool call provisions a fresh
 * workspace; pending tool calls captured by the previous process are
 * surfaced with this error so callers can decide what to do. See §2.7.
 */
export type HarnessWorkspaceLostReason =
  | 'restart'
  | 'eviction'
  | 'state_missing'
  | 'resume_failed'
  | 'generation_mismatch'
  | 'provider_unavailable'
  | 'destroyed';

export class HarnessWorkspaceLostError extends Error {
  readonly name = 'HarnessWorkspaceLostError';
  readonly reason: HarnessWorkspaceLostReason;
  readonly providerId?: string;
  readonly resourceId?: string;
  readonly generation?: string;
  constructor(
    public readonly sessionId: string,
    opts?: {
      reason?: HarnessWorkspaceLostReason;
      providerId?: string;
      resourceId?: string;
      generation?: string;
    },
  ) {
    super(
      `Workspace for session "${sessionId}" was lost: ${opts?.reason ?? 'restart'}` +
        (opts?.providerId ? ` (provider "${opts.providerId}")` : ''),
    );
    this.reason = opts?.reason ?? 'restart';
    this.providerId = opts?.providerId;
    this.resourceId = opts?.resourceId;
    this.generation = opts?.generation;
  }
}

/**
 * `provider.create` / `provider.resume` threw. Wraps the underlying cause and
 * marks the failure with the originating session/resource ids.
 */
export class HarnessWorkspaceProvisioningError extends Error {
  readonly name = 'HarnessWorkspaceProvisioningError';
  constructor(
    public readonly providerId: string,
    public readonly cause: unknown,
    public readonly sessionId?: string,
    public readonly resourceId?: string,
  ) {
    super(
      `Failed to provision workspace via provider "${providerId}": ` +
        (cause instanceof Error ? cause.message : String(cause)),
    );
  }
}

/**
 * `harness.destroyResourceWorkspace({ resourceId })` was called while sessions
 * still hold the workspace (refcount > 0). Callers are expected to close those
 * sessions first. Spec §4.5d.
 *
 * `activeSessionIds` is the spec's optional diagnostic of which sessions still
 * hold the workspace. The per-resource workspace registry currently tracks
 * only a refcount, so this is omitted until session-id tracking lands; the
 * field stays in the public shape so producers can populate it without a
 * breaking change.
 */
export class HarnessResourceWorkspaceInUseError extends Error {
  readonly name = 'HarnessResourceWorkspaceInUseError';
  constructor(
    public readonly resourceId: string,
    public readonly activeSessionIds?: string[],
  ) {
    super(
      `Workspace for resource "${resourceId}" is in use` +
        (activeSessionIds?.length ? ` by ${activeSessionIds.length} session(s)` : ''),
    );
  }
}

export class HarnessQueueFullDroppedError extends HarnessError {
  readonly name = 'HarnessQueueFullDroppedError';
  readonly code = 'harness.queue_full_dropped';
  constructor(public readonly queuedItemId?: string) {
    super(
      queuedItemId
        ? `Queued item "${queuedItemId}" was dropped because the session queue was full`
        : 'Queued work was dropped because the session queue was full',
    );
  }
}
