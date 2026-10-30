import type { CallToolResult } from '@modelcontextprotocol/server';
import {
  createTaskId,
  isTerminalTaskStatus,
  suggestedPollIntervalMs,
  taskKeyOf,
  TASKS_ERROR_CODES,
} from '../../shared/tasks';
import type {
  MCPDetailedTask,
  MCPTask,
  MCPTaskError,
  MCPTaskInputRequests,
  MCPTaskInputResponses,
  MCPTaskStatus,
} from '../../shared/tasks';
import {
  MCPTaskLimitError,
  decodeTaskListCursor,
  isPastTaskListCursor,
  matchesTaskListOptions,
  nextTaskListCursor,
  principalKeyOf,
  toListing,
} from './store';
import type {
  MCPTaskAccess,
  MCPTaskAdminOutcome,
  MCPTaskAttempt,
  MCPTaskAttemptOutcome,
  MCPTaskCreateParams,
  MCPTaskListing,
  MCPTaskListOptions,
  MCPTaskListPage,
  MCPTaskRunOptions,
  MCPTaskStore,
  MCPTaskStoreAdmin,
  MCPTaskTrace,
  MCPTaskWork,
} from './store';

/**
 * Writes the state of one in-memory task. The code executing the task holds it.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export interface MCPTaskHandle {
  readonly taskId: string;
  /** Aborts when the task is cancelled or expires. */
  readonly signal: AbortSignal;
  /** Sets the status message shown while the task works. */
  status(message: string): void;
  /**
   * Moves the task to `input_required` and resolves with the client's answers once every key is
   * answered. Keys must be unique over the task's lifetime. Rejects if the task is cancelled or expires.
   */
  requireInput(requests: MCPTaskInputRequests): Promise<MCPTaskInputResponses>;
  complete(result: CallToolResult): void;
  fail(error: MCPTaskError): void;
}

/** @experimental SEP-2663 extension; API may change. */
export interface InMemoryMCPTaskStoreOptions {
  /** How long an expired task still answers `failed` before it is forgotten. Default 60 seconds. */
  expiredRetentionMs?: number;
  /** Clock, for tests. Default `Date.now`. */
  now?: () => number;
}

interface PendingInput {
  requests: MCPTaskInputRequests;
  responses: Map<string, MCPTaskInputResponses[string]>;
  resolve: (responses: MCPTaskInputResponses) => void;
  reject: (error: Error) => void;
}

interface TaskRecord {
  taskId: string;
  taskKey: string;
  principal: string;
  clientLabel?: string;
  context?: Record<string, unknown>;
  trace?: MCPTaskTrace;
  /** Attempts started so far, for the attempt span. */
  attempts: number;
  status: MCPTaskStatus;
  statusMessage?: string;
  createdAt: number;
  lastUpdatedAt: number;
  ttlMs: number | null;
  pollIntervalMs?: number;
  usedInputKeys: Set<string>;
  pendingInput?: PendingInput;
  result?: CallToolResult;
  error?: MCPTaskError;
  abort: AbortController;
  expiryTimer?: ReturnType<typeof setTimeout>;
  /** Set once the task expired; the record is dropped after this time. */
  purgeAt?: number;
}

const DEFAULT_EXPIRED_RETENTION_MS = 60_000;

const MAX_TIMER_DELAY_MS = 2_147_483_647;

/**
 * Default {@link MCPTaskStore}: tasks live in this process. A task created here can only be read on
 * the same instance and does not survive a restart, so use it for single-instance servers.
 *
 * When a task's TTL elapses its work is aborted and it turns `failed`; it is forgotten after
 * `expiredRetentionMs`. Finished tasks stay in memory until then, so `limits.retainedPerPrincipal`
 * and `limits.retainedTotal` bound how many tasks it holds; a task with a `null` TTL counts until
 * the store closes.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export class InMemoryMCPTaskStore implements MCPTaskStore, MCPTaskStoreAdmin {
  readonly #tasks = new Map<string, TaskRecord>();
  /** The same records, by task key. */
  readonly #byKey = new Map<string, TaskRecord>();
  /** Open (non-terminal) tasks per principal, and in total. */
  readonly #openByPrincipal = new Map<string, number>();
  #open = 0;
  /** Every record held (open or finished, until purged) per principal, and in total. */
  readonly #retainedByPrincipal = new Map<string, number>();
  readonly #now: () => number;
  readonly #expiredRetentionMs: number;

  constructor(options: InMemoryMCPTaskStoreOptions = {}) {
    this.#now = options.now ?? Date.now;
    this.#expiredRetentionMs = options.expiredRetentionMs ?? DEFAULT_EXPIRED_RETENTION_MS;
  }

  async create(params: MCPTaskCreateParams, { clientLabel }: { clientLabel?: string } = {}): Promise<MCPTask> {
    assertNonNegativeInteger('ttlMs', params.ttlMs);
    assertNonNegativeInteger('pollIntervalMs', params.pollIntervalMs);
    const openForPrincipal = this.#openByPrincipal.get(params.principal) ?? 0;
    const retainedForPrincipal = this.#retainedByPrincipal.get(params.principal) ?? 0;
    const { limits } = params;
    if (limits) {
      if (openForPrincipal >= limits.perPrincipal) throw new MCPTaskLimitError('principal', limits.perPrincipal);
      if (this.#open >= limits.total) throw new MCPTaskLimitError('total', limits.total);
      if (limits.retainedPerPrincipal !== undefined && retainedForPrincipal >= limits.retainedPerPrincipal) {
        throw new MCPTaskLimitError('principal', limits.retainedPerPrincipal, 'retained');
      }
      if (limits.retainedTotal !== undefined && this.#tasks.size >= limits.retainedTotal) {
        throw new MCPTaskLimitError('total', limits.retainedTotal, 'retained');
      }
    }
    const now = this.#now();
    const taskId = createTaskId();
    const record: TaskRecord = {
      taskId,
      taskKey: taskKeyOf(taskId),
      principal: params.principal,
      clientLabel,
      context: params.context,
      ...(params.trace && { trace: params.trace }),
      attempts: 0,
      status: 'working',
      createdAt: now,
      lastUpdatedAt: now,
      ttlMs: params.ttlMs,
      pollIntervalMs: params.pollIntervalMs,
      usedInputKeys: new Set(),
      abort: new AbortController(),
    };
    if (record.ttlMs !== null) this.#arm(record, now + record.ttlMs, () => this.#expire(record));
    this.#tasks.set(record.taskId, record);
    this.#byKey.set(record.taskKey, record);
    this.#openByPrincipal.set(record.principal, openForPrincipal + 1);
    this.#open++;
    this.#retainedByPrincipal.set(record.principal, retainedForPrincipal + 1);
    return this.#snapshot(record);
  }

  async get(taskId: string, access: MCPTaskAccess): Promise<MCPDetailedTask | undefined> {
    const record = this.#lookup(taskKeyOf(taskId), access);
    return record && this.#detailed(record);
  }

  async update(taskId: string, inputResponses: MCPTaskInputResponses, access: MCPTaskAccess): Promise<boolean> {
    return this.#update(taskKeyOf(taskId), inputResponses, access) !== 'not_found';
  }

  async cancel(taskId: string, access: MCPTaskAccess): Promise<boolean> {
    return this.#cancel(taskKeyOf(taskId), access) !== 'not_found';
  }

  async list(options: MCPTaskListOptions = {}): Promise<MCPTaskListPage> {
    const limit = options.limit ?? 50;
    const cursor = decodeTaskListCursor(options.cursor);
    const matching: MCPTaskListing[] = [];
    const now = this.#now();
    for (const record of [...this.#tasks.values()].reverse()) {
      // The purge timer may not have fired yet; a record past its retention is already gone.
      if (record.purgeAt !== undefined && now >= record.purgeAt) {
        this.#purge(record);
        continue;
      }
      if (options.taskKey && record.taskKey !== options.taskKey) continue;
      const listing = toListing(
        record.taskKey,
        principalKeyOf(record.principal),
        record.context,
        this.#detailed(record),
        record.clientLabel,
      );
      if (!isPastTaskListCursor(listing, cursor) || !matchesTaskListOptions(listing, options)) continue;
      matching.push(listing);
      if (matching.length > limit) break;
    }
    const listings = matching.slice(0, limit);
    return {
      listings,
      ...(matching.length > limit && { nextCursor: nextTaskListCursor(listings, cursor) }),
    };
  }

  async updateByKey(taskKey: string, inputResponses: MCPTaskInputResponses): Promise<MCPTaskAdminOutcome> {
    return this.#update(taskKey, inputResponses);
  }

  async cancelByKey(taskKey: string): Promise<MCPTaskAdminOutcome> {
    return this.#cancel(taskKey);
  }

  #update(taskKey: string, inputResponses: MCPTaskInputResponses, access?: MCPTaskAccess): MCPTaskAdminOutcome {
    const record = this.#lookup(taskKey, access);
    if (!record) return 'not_found';
    const pending = record.pendingInput;
    if (!pending) return 'ignored';
    let accepted = false;
    for (const [key, response] of Object.entries(inputResponses)) {
      if (Object.hasOwn(pending.requests, key) && !pending.responses.has(key)) {
        pending.responses.set(key, response);
        accepted = true;
      }
    }
    if (Object.keys(pending.requests).every(key => pending.responses.has(key))) {
      record.pendingInput = undefined;
      this.#transition(record, 'working');
      pending.resolve(Object.fromEntries(pending.responses));
    }
    return accepted ? 'done' : 'ignored';
  }

  #cancel(taskKey: string, access?: MCPTaskAccess): MCPTaskAdminOutcome {
    const record = this.#lookup(taskKey, access);
    if (!record) return 'not_found';
    if (isTerminalTaskStatus(record.status)) return 'ignored';
    this.#finish(record, 'cancelled', new Error('Task was cancelled'));
    return 'done';
  }

  async traceOf(taskId: string, access: MCPTaskAccess): Promise<MCPTaskTrace | undefined> {
    return this.#lookup(taskKeyOf(taskId), access)?.trace;
  }

  /** Whether this store holds the task, for any caller. */
  has(taskId: string): boolean {
    return this.#tasks.has(taskId);
  }

  /** The context recorded at creation. */
  context(taskId: string): Record<string, unknown> | undefined {
    return this.#tasks.get(taskId)?.context;
  }

  run(taskId: string, work: MCPTaskWork, options: MCPTaskRunOptions = {}): void {
    const record = this.#tasks.get(taskId);
    if (!record) throw new Error(`MCP task ${taskKeyOf(taskId)} not found`);
    const initial = options.initialAttempt;
    if (!initial) {
      this.#attempt(record, work);
      return;
    }
    record.attempts++;
    const signal = record.abort.signal;
    const abort = () => initial.abort(signal.reason);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
    this.#settle(
      record,
      work,
      initial.outcome.finally(() => signal.removeEventListener('abort', abort)),
    );
  }

  #attempt(record: TaskRecord, work: MCPTaskWork, resume?: MCPTaskAttempt['resume']): void {
    record.attempts++;
    const attempt: MCPTaskAttempt = {
      signal: record.abort.signal,
      ...(resume && { resume }),
      ...(record.trace && {
        trace: {
          ...record.trace,
          taskKey: taskKeyOf(record.taskId),
          attempt: record.attempts,
          resumed: resume !== undefined,
          recovered: false,
        },
      }),
    };
    this.#settle(
      record,
      work,
      Promise.resolve().then(() => work(attempt)),
    );
  }

  #settle(record: TaskRecord, work: MCPTaskWork, outcome: Promise<MCPTaskAttemptOutcome>): void {
    outcome.then(
      result => this.#record(record, work, result),
      (error: unknown) =>
        this.#fail(record, {
          code: TASKS_ERROR_CODES.InternalError,
          message: error instanceof Error ? error.message : String(error),
        }),
    );
  }

  #record(record: TaskRecord, work: MCPTaskWork, outcome: MCPTaskAttemptOutcome): void {
    if (isTerminalTaskStatus(record.status)) return;
    if (outcome.status === 'completed') {
      record.result = outcome.result;
      this.#finish(record, 'completed');
      return;
    }
    const keys = Object.keys(outcome.inputRequests);
    const reused = keys.find(key => record.usedInputKeys.has(key));
    if (keys.length === 0 || reused !== undefined) {
      this.#fail(record, {
        code: TASKS_ERROR_CODES.InternalError,
        message:
          reused === undefined
            ? 'Task asked for input without any input request'
            : `Input request key "${reused}" was already used by this task`,
      });
      return;
    }
    for (const key of keys) record.usedInputKeys.add(key);
    const { suspendPayload } = outcome;
    record.pendingInput = {
      requests: outcome.inputRequests,
      responses: new Map(),
      resolve: inputResponses => this.#attempt(record, work, { inputResponses, suspendPayload }),
      // Cancellation and expiry abort the signal; nothing is waiting on this attempt.
      reject: () => {},
    };
    this.#transition(record, 'input_required');
  }

  #fail(record: TaskRecord, error: MCPTaskError): void {
    if (isTerminalTaskStatus(record.status)) return;
    record.error = error;
    this.#finish(record, 'failed', new Error(error.message));
  }

  /** The writer for a task this store holds. Writes after the task is terminal are ignored. */
  handle(taskId: string): MCPTaskHandle {
    const record = this.#tasks.get(taskId);
    if (!record) throw new Error(`MCP task ${taskKeyOf(taskId)} not found`);
    const live = () => !isTerminalTaskStatus(record.status);
    return {
      taskId,
      signal: record.abort.signal,
      status: message => {
        if (!live()) return;
        record.statusMessage = message;
        record.lastUpdatedAt = this.#now();
      },
      requireInput: requests => {
        if (!live()) return Promise.reject(new Error(`MCP task ${taskKeyOf(taskId)} is no longer running`));
        if (record.pendingInput)
          return Promise.reject(new Error(`MCP task ${taskKeyOf(taskId)} is already waiting for input`));
        const keys = Object.keys(requests);
        if (keys.length === 0) return Promise.reject(new Error('requireInput needs at least one input request'));
        const reused = keys.find(key => record.usedInputKeys.has(key));
        if (reused !== undefined) {
          return Promise.reject(
            new Error(`Input request key "${reused}" was already used by MCP task ${taskKeyOf(taskId)}`),
          );
        }
        for (const key of keys) record.usedInputKeys.add(key);
        return new Promise<MCPTaskInputResponses>((resolve, reject) => {
          record.pendingInput = { requests, responses: new Map(), resolve, reject };
          this.#transition(record, 'input_required');
        });
      },
      complete: result => {
        if (!live()) return;
        record.result = result;
        this.#finish(record, 'completed');
      },
      fail: error => {
        if (!live()) return;
        record.error = error;
        this.#finish(record, 'failed');
      },
    };
  }

  /** Cancels all running work, invalidates every handle and forgets every task. */
  close(): void {
    for (const record of this.#tasks.values()) {
      clearTimeout(record.expiryTimer);
      if (!isTerminalTaskStatus(record.status)) this.#finish(record, 'cancelled', new Error('MCP task store closed'));
    }
    this.#tasks.clear();
    this.#byKey.clear();
    this.#openByPrincipal.clear();
    this.#open = 0;
    this.#retainedByPrincipal.clear();
  }

  /** Without `access`, any principal's task (admin). */
  #lookup(taskKey: string, access?: MCPTaskAccess): TaskRecord | undefined {
    const record = this.#byKey.get(taskKey);
    if (!record || (access && record.principal !== access.principal)) return undefined;
    if (record.purgeAt !== undefined && this.#now() >= record.purgeAt) {
      this.#purge(record);
      return undefined;
    }
    return record;
  }

  /** Forgets an expired task, freeing its retained slot. */
  #purge(record: TaskRecord): void {
    if (this.#tasks.get(record.taskId) !== record) return;
    clearTimeout(record.expiryTimer);
    this.#tasks.delete(record.taskId);
    this.#byKey.delete(record.taskKey);
    const retained = this.#retainedByPrincipal.get(record.principal)! - 1;
    if (retained === 0) this.#retainedByPrincipal.delete(record.principal);
    else this.#retainedByPrincipal.set(record.principal, retained);
  }

  /** setTimeout fires after 1 ms past 2^31-1 ms (~24.8 days), so a longer wait goes in steps. */
  #arm(record: TaskRecord, at: number, fire: () => void): void {
    const delay = at - this.#now();
    record.expiryTimer =
      delay > MAX_TIMER_DELAY_MS
        ? setTimeout(() => this.#arm(record, at, fire), MAX_TIMER_DELAY_MS)
        : setTimeout(fire, delay);
    record.expiryTimer.unref?.();
  }

  #expire(record: TaskRecord): void {
    if (!isTerminalTaskStatus(record.status)) {
      record.error = { code: TASKS_ERROR_CODES.InternalError, message: 'Task expired before it finished' };
      this.#finish(record, 'failed', new Error('Task expired'));
    }
    record.purgeAt = this.#now() + this.#expiredRetentionMs;
    this.#arm(record, record.purgeAt, () => this.#purge(record));
  }

  #transition(record: TaskRecord, status: MCPTaskStatus): void {
    record.status = status;
    record.lastUpdatedAt = this.#now();
  }

  /** The only way a task turns terminal, so it is also where it stops counting as open. */
  #finish(record: TaskRecord, status: 'completed' | 'failed' | 'cancelled', reason?: Error): void {
    const open = this.#openByPrincipal.get(record.principal)! - 1;
    if (open === 0) this.#openByPrincipal.delete(record.principal);
    else this.#openByPrincipal.set(record.principal, open);
    this.#open--;
    this.#transition(record, status);
    const pending = record.pendingInput;
    record.pendingInput = undefined;
    pending?.reject(reason ?? new Error(`MCP task "${taskKeyOf(record.taskId)}" ${status} while waiting for input`));
    if (reason) record.abort.abort(reason);
  }

  #snapshot(record: TaskRecord): MCPTask {
    return {
      taskId: record.taskId,
      status: record.status,
      ...(record.statusMessage !== undefined && { statusMessage: record.statusMessage }),
      createdAt: new Date(record.createdAt).toISOString(),
      lastUpdatedAt: new Date(record.lastUpdatedAt).toISOString(),
      ttlMs: record.ttlMs,
      pollIntervalMs: record.pollIntervalMs ?? suggestedPollIntervalMs(record.createdAt, this.#now()),
    };
  }

  #detailed(record: TaskRecord): MCPDetailedTask {
    const base = this.#snapshot(record);
    switch (record.status) {
      case 'input_required': {
        const { requests, responses } = record.pendingInput!;
        const open = Object.fromEntries(Object.entries(requests).filter(([key]) => !responses.has(key)));
        return { ...base, status: 'input_required', inputRequests: open };
      }
      case 'completed':
        return { ...base, status: 'completed', result: { ...record.result! } };
      case 'failed':
        return { ...base, status: 'failed', error: { ...record.error! } };
      case 'working':
      case 'cancelled':
        return { ...base, status: record.status };
    }
  }
}

function assertNonNegativeInteger(name: string, value: number | null | undefined): void {
  if (value === null || value === undefined) return;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer, got ${value}`);
  }
}
