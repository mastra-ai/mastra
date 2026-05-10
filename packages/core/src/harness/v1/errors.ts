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

/**
 * Tool emitted `tool_update` / `shell_output` via `ctx.emitEvent` but the
 * referenced `toolCallId` is not in the session's `activeTools` map (no
 * matching `tool_start` is in flight, or `tool_end` already fired). The
 * harness rejects synchronously so subscribers don't see progress events
 * disconnected from a tool's lifetime.
 */
export class HarnessToolEmitError extends Error {
  readonly name = 'HarnessToolEmitError';
  constructor(
    public readonly sessionId: string,
    public readonly eventType: string,
    public readonly toolCallId: string,
  ) {
    super(
      `Cannot emit "${eventType}" for tool call "${toolCallId}" on session "${sessionId}" — no active tool with that id`,
    );
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
  ) {
    super(`Queue for session "${sessionId}" is full (max ${maxQueueDepth})`);
  }
}

/**
 * Durable write rejected by the storage adapter — exhausted the harness's
 * one transparent retry. `cause` carries the underlying storage error.
 */
export class HarnessStorageError extends Error {
  readonly name = 'HarnessStorageError';
  constructor(
    public readonly sessionId: string,
    public readonly operation: 'flush' | 'load' | 'attachment',
    public readonly cause: unknown,
  ) {
    super(`Harness storage ${operation} failed for session "${sessionId}"`);
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
 * `ctx.emitEvent(...)` (or any other harness-event publish path) received a
 * payload that is not JSON-serializable. The check runs synchronously before
 * any subscriber observes the event, so in-process listeners and remote/SSE
 * subscribers see the same contract.
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
