/**
 * Correlated request state for the Subconscious reminder ask lane.
 *
 * A memory question is a request, not a run. The reminder agent may service several questions inside a
 * single woken run, and a run may finish without answering anything, so run boundaries cannot identify an
 * individual question. Each question therefore gets a correlation ID before dispatch and lives here until
 * exactly one terminal result is recorded against that ID.
 *
 * The registry is deliberately process-local and in-memory: it holds live waiters for callers that block,
 * so it has nothing meaningful to recover after a restart. Requests that were pending when the process
 * exits are simply lost; nothing here claims cross-process or durable delivery.
 */

/** How long a request may stay pending, and how long its terminal result is retained after settlement. */
export const LANE_TURN_DEADLINE_MS = 120_000;

/**
 * Terminal states a request can reach. Exactly one of these is recorded per request.
 *
 * Every state here is one something outside this module can actually cause. A bug in our own
 * settlement code is not modelled as a state: it throws, and the deadline stays the backstop.
 */
export type RemindRequestFailureStatus = 'timed_out' | 'model_failed' | 'aborted' | 'delivery_failed';

export type RemindRequestStatus = 'pending' | 'replied' | RemindRequestFailureStatus;

export type RemindRequestResult =
  | { ok: true; correlationId: string; status: 'replied'; answer: string }
  | { ok: false; correlationId: string; status: RemindRequestFailureStatus; error: string };

/** Lane identity a request belongs to. Replies are validated against trusted runtime values, never model input. */
export type RemindLane = {
  /** Thread the reminder agent runs on, e.g. `subconscious:<parentThreadId>:remind`. */
  remindThreadId: string;
  /** Canonical lane resource ID. */
  resourceId: string;
};

export type RemindRequestRecord = {
  correlationId: string;
  question: string;
  lane: RemindLane;
  /** Thread the asking agent was on, retained for detached answer delivery. */
  parentThreadId: string;
  createdAt: number;
  deadlineAt: number;
  status: RemindRequestStatus;
  /** Run the request was associated with once `sendMessage()` reported its disposition. */
  runId?: string;
  /** Resolves once the request settles. Always resolves, never rejects. */
  settled: Promise<RemindRequestResult>;
};

/** Outcome of an attempt to move a request to a terminal state. */
export type RemindCompletion =
  | { outcome: 'settled'; result: RemindRequestResult }
  /** Exact retry of an already-recorded terminal result. Nothing was re-emitted. */
  | { outcome: 'duplicate'; result: RemindRequestResult }
  /** Rejected: unknown/expired ID, wrong lane, or a completion incompatible with the recorded result. */
  | { outcome: 'rejected'; reason: 'unknown' | 'wrong_lane' | 'conflict'; result?: RemindRequestResult };

type Entry = {
  record: RemindRequestRecord;
  resolve: (result: RemindRequestResult) => void;
  deadlineTimer?: ReturnType<typeof setTimeout>;
  pruneTimer?: ReturnType<typeof setTimeout>;
  result?: RemindRequestResult;
  settledAt?: number;
};

function sameResult(a: RemindRequestResult, b: RemindRequestResult): boolean {
  if (a.status !== b.status) return false;
  if (a.ok && b.ok) return a.answer === b.answer;
  if (!a.ok && !b.ok) return a.error === b.error;
  return false;
}

function sameLane(a: RemindLane, b: RemindLane): boolean {
  return a.remindThreadId === b.remindThreadId && a.resourceId === b.resourceId;
}

/**
 * In-process registry of correlated reminder questions.
 *
 * One registry is owned by a long-lived `Memory` instance and shared by every reminder agent it creates, so
 * a question delivered into an already-running passive reminder turn can still be answered.
 */
export class RemindRequestRegistry {
  readonly #entries = new Map<string, Entry>();
  readonly #retentionMs: number;
  readonly #deadlineMs: number;

  constructor(options: { retentionMs?: number; deadlineMs?: number } = {}) {
    this.#retentionMs = options.retentionMs ?? LANE_TURN_DEADLINE_MS;
    this.#deadlineMs = options.deadlineMs ?? LANE_TURN_DEADLINE_MS;
  }

  /**
   * Register a pending request. The correlation ID is supplied by the caller and must already exist before
   * the question is dispatched, so identity never depends on what the transport reports back.
   */
  create(args: {
    correlationId: string;
    question: string;
    lane: RemindLane;
    parentThreadId: string;
    deadlineMs?: number;
    now?: number;
  }): RemindRequestRecord {
    const existing = this.#entries.get(args.correlationId);
    if (existing) {
      throw new Error(`Remind request ${args.correlationId} already exists`);
    }

    const createdAt = args.now ?? Date.now();
    const deadlineMs = args.deadlineMs ?? this.#deadlineMs;

    let resolve!: (result: RemindRequestResult) => void;
    const settled = new Promise<RemindRequestResult>(r => (resolve = r));

    const record: RemindRequestRecord = {
      correlationId: args.correlationId,
      question: args.question,
      lane: { ...args.lane },
      parentThreadId: args.parentThreadId,
      createdAt,
      deadlineAt: createdAt + deadlineMs,
      status: 'pending',
      settled,
    };

    const entry: Entry = { record, resolve };
    entry.deadlineTimer = setTimeout(() => {
      this.complete(args.correlationId, {
        ok: false,
        correlationId: args.correlationId,
        status: 'timed_out',
        error: `Memory question timed out after ${deadlineMs}ms`,
      });
    }, deadlineMs);
    entry.deadlineTimer.unref?.();

    this.#entries.set(args.correlationId, entry);
    return record;
  }

  get(correlationId: string): RemindRequestRecord | undefined {
    return this.#entries.get(correlationId)?.record;
  }

  /** Bind a request to the run that accepted it, so a failure of that run can settle exactly its requests. */
  associateRun(correlationId: string, runId: string): void {
    const entry = this.#entries.get(correlationId);
    if (!entry || entry.record.status !== 'pending') return;
    entry.record.runId = runId;
  }

  /** Correlation IDs still pending on a given run. */
  pendingForRun(runId: string): string[] {
    const ids: string[] = [];
    for (const entry of this.#entries.values()) {
      if (entry.record.status === 'pending' && entry.record.runId === runId) {
        ids.push(entry.record.correlationId);
      }
    }
    return ids;
  }

  /**
   * Record a terminal result. The first pending-to-terminal transition wins; an exact retry of that result is
   * reported as a duplicate without re-settling, and anything else against a completed ID is rejected.
   */
  complete(correlationId: string, result: RemindRequestResult, lane?: RemindLane): RemindCompletion {
    const entry = this.#entries.get(correlationId);
    if (!entry) return { outcome: 'rejected', reason: 'unknown' };
    if (lane && !sameLane(entry.record.lane, lane)) return { outcome: 'rejected', reason: 'wrong_lane' };

    if (entry.record.status !== 'pending') {
      const recorded = entry.result!;
      return sameResult(recorded, result)
        ? { outcome: 'duplicate', result: recorded }
        : { outcome: 'rejected', reason: 'conflict', result: recorded };
    }

    entry.record.status = result.status;
    entry.result = result;
    entry.settledAt = Date.now();
    if (entry.deadlineTimer) {
      clearTimeout(entry.deadlineTimer);
      entry.deadlineTimer = undefined;
    }
    entry.resolve(result);

    entry.pruneTimer = setTimeout(() => {
      this.#entries.delete(correlationId);
    }, this.#retentionMs);
    entry.pruneTimer.unref?.();

    return { outcome: 'settled', result };
  }

  /** Drop retained terminal records whose retention window has elapsed. Pending requests are never pruned. */
  prune(now: number = Date.now()): void {
    for (const [correlationId, entry] of this.#entries) {
      if (entry.record.status === 'pending' || entry.settledAt === undefined) continue;
      if (now - entry.settledAt >= this.#retentionMs) {
        if (entry.pruneTimer) clearTimeout(entry.pruneTimer);
        this.#entries.delete(correlationId);
      }
    }
  }

  /** Number of tracked records (pending plus retained terminal). Exposed for leak assertions. */
  get size(): number {
    return this.#entries.size;
  }

  /** Release all timers. Pending waiters are settled as aborted so nothing is left hanging. */
  dispose(): void {
    for (const correlationId of [...this.#entries.keys()]) {
      const entry = this.#entries.get(correlationId)!;
      if (entry.record.status === 'pending') {
        this.complete(correlationId, {
          ok: false,
          correlationId,
          status: 'aborted',
          error: 'Reminder request registry disposed',
        });
      }
      const current = this.#entries.get(correlationId);
      if (current?.pruneTimer) clearTimeout(current.pruneTimer);
      this.#entries.delete(correlationId);
    }
  }
}
