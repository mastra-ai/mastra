import { createHash } from 'node:crypto';
import type { BackgroundTask, BackgroundTaskManager, TaskContext, ToolExecutor } from '@mastra/core/background-tasks';
import type { IMastraLogger } from '@mastra/core/logger';
import type { BackgroundTasksStorage } from '@mastra/core/storage';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { createTaskId, suggestedPollIntervalMs, TASKS_ERROR_CODES } from '../../shared/tasks';
import type { MCPDetailedTask, MCPTask, MCPTaskInputRequests, MCPTaskInputResponses } from '../../shared/tasks';
import type {
  MCPTaskAccess,
  MCPTaskAttempt,
  MCPTaskCreateParams,
  MCPTaskRunOptions,
  MCPTaskStore,
  MCPTaskWork,
} from './store';

/** What the store needs from a task's `context`: which tool it runs. */
export interface BackgroundToolTaskContext extends Record<string, unknown> {
  toolName: string;
}

export interface BackgroundTaskMCPTaskStoreOptions {
  manager: BackgroundTaskManager;
  /** The MCP server's id; scopes rows, owners and static executors to this server. */
  serverId: string;
  /** Rebuilds a task's work from nothing but its persisted context. */
  workFor: (context: BackgroundToolTaskContext) => MCPTaskWork;
  /** Whether a crashed attempt of this tool runs again. */
  recoverFor: (toolName: string) => boolean;
  /** Read on every log, since Mastra sets the server's logger after registering it. */
  logger?: () => IMastraLogger;
}

/** The MCP side of a task, kept in the row's `metadata`. */
export interface BackgroundTaskEnvelope {
  v: 1;
  principal: string;
  ttlMs: number | null;
  pollIntervalMs?: number;
  recover: boolean;
  /** The open suspension's requests, and the answers given to them so far. */
  inputRequests?: MCPTaskInputRequests;
  inputResponses?: MCPTaskInputResponses;
  /** Every input key this task ever asked for; keys must be unique over its lifetime. */
  usedInputKeys: string[];
}

/** What the executor receives as `args`: it gets nothing else from the row. */
interface RowArgs {
  taskKey: string;
  context: BackgroundToolTaskContext;
}

/** What `tasks/update` hands the resumed attempt through `resumeData`. */
interface RowResume {
  inputResponses: MCPTaskInputResponses;
  suspendPayload: unknown;
}

const ENVELOPE_VERSION = 1;
/** For `ttlMs: null`: a deadline cleanup never reaches. */
const NEVER = new Date('9999-12-31T00:00:00.000Z');
/** The longest delay `setTimeout` honours; larger values fire at once. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
/** How long an expired task still answers `failed` before it is forgotten. */
const EXPIRED_RETENTION_MS = 60_000;
/** What core writes when recovery reclaims a crashed attempt it won't run again. */
const CORE_LOST_MESSAGE = 'Worker process terminated before task completed';
export const TASK_LOST_MESSAGE = 'task lost: the server restarted while it was running';
export const TASK_EXPIRED_MESSAGE = 'Task expired before it finished';
const TERMINAL_ROW_STATUSES = new Set<BackgroundTask['status']>(['completed', 'failed', 'cancelled', 'timed_out']);
const UPDATE_ATTEMPTS = 3;

/** The row key for a task id. The id is a bearer token, so only its hash is stored. */
export function taskKeyOf(taskId: string): string {
  return createHash('sha256').update(taskId).digest('base64url');
}

function isTerminalRow(row: BackgroundTask): boolean {
  return TERMINAL_ROW_STATUSES.has(row.status);
}

function envelopeOf(row: BackgroundTask): BackgroundTaskEnvelope | undefined {
  const metadata = row.metadata as Partial<BackgroundTaskEnvelope> | undefined;
  return metadata?.v === ENVELOPE_VERSION && typeof metadata.principal === 'string'
    ? (metadata as BackgroundTaskEnvelope)
    : undefined;
}

function openInputRequests(envelope: BackgroundTaskEnvelope): MCPTaskInputRequests {
  const answered = envelope.inputResponses ?? {};
  return Object.fromEntries(Object.entries(envelope.inputRequests ?? {}).filter(([key]) => !(key in answered)));
}

function isFullyAnswered(row: BackgroundTask, envelope: BackgroundTaskEnvelope): boolean {
  return (
    row.status === 'suspended' &&
    Object.keys(envelope.inputRequests ?? {}).length > 0 &&
    Object.keys(openInputRequests(envelope)).length === 0
  );
}

function isExpired(row: BackgroundTask, now: number): boolean {
  return row.expiresAt !== undefined && row.expiresAt.getTime() <= now;
}

function latest(...dates: Array<Date | undefined>): Date {
  return new Date(Math.max(...dates.filter((date): date is Date => date !== undefined).map(date => date.getTime())));
}

/**
 * Projects a background-task row onto the MCP task it backs, as `tasks/get` answers it.
 *
 * A row still running past its TTL reads as `failed` before the sweep gets to it.
 */
export function projectTask(
  row: BackgroundTask,
  envelope: BackgroundTaskEnvelope,
  taskId: string,
  now: number,
): MCPDetailedTask {
  const base: MCPTask = {
    taskId,
    status: 'working',
    createdAt: row.createdAt.toISOString(),
    lastUpdatedAt: latest(row.createdAt, row.startedAt, row.suspendedAt, row.completedAt).toISOString(),
    ttlMs: envelope.ttlMs,
    pollIntervalMs: envelope.pollIntervalMs ?? suggestedPollIntervalMs(row.createdAt.getTime(), now),
  };
  const failed = (message: string): MCPDetailedTask => ({
    ...base,
    status: 'failed',
    error: { code: TASKS_ERROR_CODES.InternalError, message },
  });
  if (!isTerminalRow(row) && isExpired(row, now)) return failed(TASK_EXPIRED_MESSAGE);
  switch (row.status) {
    case 'pending':
    case 'running':
      return base as MCPDetailedTask;
    case 'suspended': {
      const open = openInputRequests(envelope);
      // Every key answered: the resume is on its way, so the task is working again.
      return Object.keys(open).length === 0
        ? (base as MCPDetailedTask)
        : { ...base, status: 'input_required', inputRequests: open };
    }
    case 'completed':
      return { ...base, status: 'completed', result: { ...(row.result as CallToolResult) } };
    case 'cancelled':
      return { ...base, status: 'cancelled' };
    case 'timed_out':
      return failed(isExpired(row, now) ? TASK_EXPIRED_MESSAGE : (row.error?.message ?? 'Task timed out'));
    case 'failed': {
      const message = row.error?.message ?? 'Task failed';
      return failed(message === CORE_LOST_MESSAGE ? TASK_LOST_MESSAGE : message);
    }
  }
}

interface Gate {
  promise: Promise<{ work: MCPTaskWork; options: MCPTaskRunOptions }>;
  resolve: (value: { work: MCPTaskWork; options: MCPTaskRunOptions }) => void;
}

/**
 * An {@link MCPTaskStore} on Mastra's background tasks: every MCP task is a background-task row in
 * Mastra's storage, so any instance sharing that storage can read, answer and cancel it, and run it.
 *
 * Rows are owned by `mcp-server:<serverId>` and keyed by a hash of the task id. Each attempt runs
 * the tool's work rebuilt from the row (`workFor`), through a static executor registered for
 * every task tool, so a worker other than the creating one can run it.
 */
export class BackgroundTaskMCPTaskStore implements MCPTaskStore {
  readonly #manager: BackgroundTaskManager;
  readonly #owner: string;
  readonly #workFor: BackgroundTaskMCPTaskStoreOptions['workFor'];
  readonly #recoverFor: BackgroundTaskMCPTaskStoreOptions['recoverFor'];
  readonly #getLogger?: () => IMastraLogger;
  readonly #gates = new Map<string, Gate>();
  readonly #executors = new Set<string>();
  /** Rows this instance reclaimed for another attempt but could not dispatch yet. */
  readonly #reclaimed = new Set<string>();
  #sweepTimer?: ReturnType<typeof setInterval>;
  #sweeping?: Promise<void>;

  constructor(options: BackgroundTaskMCPTaskStoreOptions) {
    this.#manager = options.manager;
    this.#owner = `mcp-server:${options.serverId}`;
    this.#workFor = options.workFor;
    this.#recoverFor = options.recoverFor;
    this.#getLogger = options.logger;
  }

  /** The `agentId` every row of this server carries. */
  get owner(): string {
    return this.#owner;
  }

  /**
   * Registers the executor that runs `toolName`'s tasks on any worker. It must be registered on
   * every instance before the manager recovers rows, or recovered attempts find no executor.
   */
  registerTool(toolName: string): void {
    const key = `${this.#owner}:${toolName}`;
    this.#manager.registerStaticExecutor(key, {
      execute: (args, options) => {
        const { context } = args as unknown as RowArgs;
        return this.#execute(this.#workFor(context), args as unknown as RowArgs, options);
      },
    });
    this.#executors.add(key);
    this.#startSweeping();
  }

  async create(params: MCPTaskCreateParams): Promise<MCPTask> {
    const context = params.context as BackgroundToolTaskContext | undefined;
    if (!context || typeof context.toolName !== 'string') {
      throw new Error('A background-task MCP task needs the tool it runs in its context');
    }
    // Tools added after registration get their executor on first use.
    if (!this.#executors.has(`${this.#owner}:${context.toolName}`)) this.registerTool(context.toolName);
    const taskId = createTaskId();
    const taskKey = taskKeyOf(taskId);
    const recover = this.#recoverFor(context.toolName);
    const envelope: BackgroundTaskEnvelope = {
      v: ENVELOPE_VERSION,
      principal: params.principal,
      ttlMs: params.ttlMs,
      ...(params.pollIntervalMs !== undefined && { pollIntervalMs: params.pollIntervalMs }),
      recover,
      usedInputKeys: [],
    };
    const createdAt = Date.now();
    const gate = {} as Gate;
    gate.promise = new Promise(resolve => (gate.resolve = resolve));
    this.#gates.set(taskId, gate);

    // Process-affine: the first attempt may be the one already running under this request, so
    // it must not be dispatched elsewhere. Later attempts go through `work` here as well.
    let first = true;
    const executor: ToolExecutor = {
      execute: async (args, options) => {
        const { work, options: runOptions } = await gate.promise;
        const initial = first ? runOptions.initialAttempt : undefined;
        first = false;
        return this.#execute(work, args as unknown as RowArgs, options, initial);
      },
    };
    const taskContext: TaskContext = { executor };
    const args: RowArgs = { taskKey, context };
    try {
      const { fallbackToSync } = await this.#manager.enqueue(
        {
          runId: taskKey,
          toolName: context.toolName,
          toolCallId: taskKey,
          args: args as unknown as Record<string, unknown>,
          agentId: this.#owner,
          resourceId: `${this.#owner}:${params.principal}`,
          timeoutMs: params.ttlMs === null ? MAX_TIMEOUT_MS : Math.min(Math.max(params.ttlMs, 1), MAX_TIMEOUT_MS),
          maxRetries: recover ? 1 : 0,
          expiresAt: params.ttlMs === null ? NEVER : new Date(createdAt + params.ttlMs),
          metadata: envelope as unknown as Record<string, unknown>,
        },
        taskContext,
      );
      if (fallbackToSync) {
        throw new Error("Background tasks are at capacity and backpressure is 'fallback-sync'; MCP tasks need 'queue'");
      }
    } catch (error) {
      this.#gates.delete(taskId);
      throw error;
    }
    return {
      taskId,
      status: 'working',
      createdAt: new Date(createdAt).toISOString(),
      lastUpdatedAt: new Date(createdAt).toISOString(),
      ttlMs: params.ttlMs,
      pollIntervalMs: params.pollIntervalMs ?? suggestedPollIntervalMs(createdAt, createdAt),
    };
  }

  run(taskId: string, work: MCPTaskWork, options: MCPTaskRunOptions = {}): void {
    const gate = this.#gates.get(taskId);
    if (!gate) throw new Error(`MCP task "${taskId}" not found`);
    this.#gates.delete(taskId);
    gate.resolve({ work, options });
  }

  async get(taskId: string, access: MCPTaskAccess): Promise<MCPDetailedTask | undefined> {
    const found = await this.#find(taskId, access);
    if (!found) return undefined;
    const { row, envelope } = found;
    // A task finished on another instance leaves its context registered here.
    if (isTerminalRow(row)) this.#manager.deregisterTaskContext(row.id);
    // The resume queued for a fully answered task is process-local; issue it again in case it was lost.
    if (isFullyAnswered(row, envelope)) await this.#resume(row, envelope);
    return projectTask(row, envelope, taskId, Date.now());
  }

  async update(taskId: string, inputResponses: MCPTaskInputResponses, access: MCPTaskAccess): Promise<boolean> {
    const found = await this.#find(taskId, access);
    if (!found) return false;
    let { row, envelope } = found;
    const storage = await this.#manager.getStorage();
    // The answers are persisted before acknowledging: the resume they trigger may be lost with
    // this process, and whichever instance sees the answered row next resumes it.
    for (let attempt = 0; attempt < UPDATE_ATTEMPTS && row.status === 'suspended'; attempt++) {
      const open = openInputRequests(envelope);
      const accepted = Object.entries(inputResponses).filter(([key]) => key in open);
      if (accepted.length === 0) break;
      const next: BackgroundTaskEnvelope = {
        ...envelope,
        inputResponses: { ...envelope.inputResponses, ...Object.fromEntries(accepted) },
      };
      const written = await storage.updateTask(
        row.id,
        { metadata: next as unknown as Record<string, unknown> },
        { expectedStatus: 'suspended' },
      );
      const reread = await storage.getTask(row.id);
      const rereadEnvelope = reread && envelopeOf(reread);
      if (!reread || !rereadEnvelope) return true;
      row = reread;
      envelope = rereadEnvelope;
      // A concurrent update can overwrite these answers; check they landed, and write again if not.
      if (written && accepted.every(([key]) => key in (envelope.inputResponses ?? {}))) break;
    }
    if (isFullyAnswered(row, envelope)) await this.#resume(row, envelope);
    return true;
  }

  async cancel(taskId: string, access: MCPTaskAccess): Promise<boolean> {
    const found = await this.#find(taskId, access);
    if (!found) return false;
    if (!isTerminalRow(found.row)) {
      try {
        await this.#manager.cancel(found.row.id);
      } catch (error) {
        this.#getLogger?.().warn('Could not cancel MCP task', { error });
      }
    }
    return true;
  }

  /** Unregisters this store's executors. Rows stay in storage. */
  close(): void {
    for (const key of this.#executors) this.#manager.unregisterStaticExecutor(key);
    this.#executors.clear();
    clearInterval(this.#sweepTimer);
    this.#sweepTimer = undefined;
  }

  /**
   * Repairs what no request would: expires rows past their TTL, resumes answered rows whose
   * process-local resume was lost, and settles rows whose worker died while this manager was
   * already running (the manager itself only recovers rows when it starts).
   */
  sweep(): Promise<void> {
    this.#sweeping ??= this.#sweep().finally(() => (this.#sweeping = undefined));
    return this.#sweeping;
  }

  #startSweeping(): void {
    if (this.#sweepTimer) return;
    // Once per lease: a dead worker's rows are noticed about a lease after it stops renewing.
    this.#sweepTimer = setInterval(() => {
      this.sweep().catch(error => this.#getLogger?.().debug('MCP task sweep failed', { error }));
    }, this.#manager.config.leaseDurationMs);
    this.#sweepTimer.unref?.();
  }

  async #sweep(): Promise<void> {
    const rows: BackgroundTask[] = [];
    const perPage = 100;
    for (let page = 0; ; page++) {
      const { tasks, total } = await this.#manager.listTasks({
        agentId: this.#owner,
        status: ['pending', 'running', 'suspended'],
        orderBy: 'createdAt',
        orderDirection: 'asc',
        page,
        perPage,
      });
      rows.push(...tasks);
      if (tasks.length < perPage || rows.length >= total) break;
    }
    const storage = await this.#manager.getStorage();
    const now = Date.now();
    for (const row of rows) {
      const envelope = envelopeOf(row);
      if (!envelope) continue;
      try {
        if (isExpired(row, now)) await this.#expire(storage, row);
        else if (isFullyAnswered(row, envelope)) await this.#resume(row, envelope);
        else if (row.status === 'running' && row.leaseExpiresAt && row.leaseExpiresAt.getTime() <= now) {
          await this.#reclaim(storage, row, envelope);
        } else if (row.status === 'pending' && this.#reclaimed.has(row.id)) await this.#restart(row.id);
      } catch (error) {
        this.#getLogger?.().debug('Could not sweep MCP task', { error });
      }
    }
  }

  /** Aborts the work, then records the task as failed until its retention ends. */
  async #expire(storage: BackgroundTasksStorage, row: BackgroundTask): Promise<void> {
    await this.#manager.cancel(row.id);
    await storage.updateTask(
      row.id,
      {
        status: 'failed',
        error: { message: TASK_EXPIRED_MESSAGE },
        completedAt: new Date(),
        // Kept as long as a finished task would be, so `tasks/get` can still report the failure.
        expiresAt: new Date(Date.now() + EXPIRED_RETENTION_MS),
      },
      { expectedStatus: 'cancelled' },
    );
    this.#reclaimed.delete(row.id);
  }

  /**
   * A running row whose lease lapsed: its worker died. Fenced like the manager's own recovery, so
   * of all instances (and managers) noticing it, exactly one settles it.
   */
  async #reclaim(
    storage: BackgroundTasksStorage,
    row: BackgroundTask,
    envelope: BackgroundTaskEnvelope,
  ): Promise<void> {
    const fence = {
      expectedStatus: 'running' as const,
      expectedOwnerId: row.ownerId ?? null,
      expectedLeaseExpiresAt: row.leaseExpiresAt ?? null,
    };
    if (envelope.recover && row.retryCount < row.maxRetries) {
      const won = await storage.updateTask(
        row.id,
        { status: 'pending', retryCount: row.retryCount + 1, ownerId: undefined, leaseExpiresAt: undefined },
        fence,
      );
      if (!won) return;
      this.#reclaimed.add(row.id);
      await this.#restart(row.id);
      return;
    }
    await storage.updateTask(
      row.id,
      {
        status: 'failed',
        error: { message: TASK_LOST_MESSAGE },
        completedAt: new Date(),
        ownerId: undefined,
        leaseExpiresAt: undefined,
      },
      fence,
    );
  }

  /** Dispatches a reclaimed row; the dispatch claim is fenced, so it runs once however often this is called. */
  async #restart(rowId: string): Promise<void> {
    try {
      await this.#manager.restart(rowId);
      this.#reclaimed.delete(rowId);
    } catch (error) {
      // No slot yet, or another worker already took it: the next sweep tries again.
      this.#getLogger?.().debug('Could not restart MCP task', { error });
    }
  }

  async #find(
    taskId: string,
    access: MCPTaskAccess,
  ): Promise<{ row: BackgroundTask; envelope: BackgroundTaskEnvelope } | undefined> {
    const { tasks } = await this.#manager.listTasks({
      agentId: this.#owner,
      resourceId: `${this.#owner}:${access.principal}`,
      toolCallId: taskKeyOf(taskId),
      perPage: 1,
    });
    const row = tasks[0];
    const envelope = row && envelopeOf(row);
    if (!row || !envelope || envelope.principal !== access.principal) return undefined;
    // Terminal past its deadline: gone, whether or not cleanup has deleted the row yet.
    if (isTerminalRow(row) && row.expiresAt && row.expiresAt.getTime() + EXPIRED_RETENTION_MS <= Date.now()) {
      return undefined;
    }
    return { row, envelope };
  }

  async #resume(row: BackgroundTask, envelope: BackgroundTaskEnvelope): Promise<void> {
    const resumeData: RowResume = { inputResponses: envelope.inputResponses ?? {}, suspendPayload: row.suspendPayload };
    try {
      await this.#manager.resume(row.id, resumeData, { onNoSlot: 'queue' });
    } catch (error) {
      // Resumed or cancelled meanwhile, or the manager is down: the next read or sweep tries again.
      this.#getLogger?.().debug('Could not resume MCP task', { error });
    }
  }

  /** Runs one attempt and turns its outcome into what the background-task workflow records. */
  async #execute(
    work: MCPTaskWork,
    args: RowArgs,
    options: Parameters<ToolExecutor['execute']>[1],
    initial?: MCPTaskRunOptions['initialAttempt'],
  ): Promise<unknown> {
    const signal = options?.abortSignal ?? new AbortController().signal;
    const resumeData = options?.resumeData as RowResume | undefined;
    let outcome: Promise<Awaited<ReturnType<MCPTaskWork>>>;
    if (initial) {
      const abort = () => initial.abort(signal.reason);
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
      outcome = initial.outcome.finally(() => signal.removeEventListener('abort', abort));
    } else {
      const attempt: MCPTaskAttempt = {
        signal,
        ...(resumeData && {
          resume: { inputResponses: resumeData.inputResponses, suspendPayload: resumeData.suspendPayload },
        }),
      };
      outcome = Promise.resolve().then(() => work(attempt));
    }
    // An attempt that ignores its signal must still end, so the workflow can record the abort.
    const result = await new Promise<Awaited<typeof outcome>>((resolve, reject) => {
      const onAbort = () => reject(signal.reason ?? new Error('Task cancelled'));
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
      outcome.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
    if (result.status === 'completed') return result.result;

    const storage = await this.#manager.getStorage();
    const { tasks } = await this.#manager.listTasks({ agentId: this.#owner, toolCallId: args.taskKey, perPage: 1 });
    const row = tasks[0];
    const envelope = row && envelopeOf(row);
    if (!row || !envelope) throw new Error('MCP task row is gone');
    const keys = Object.keys(result.inputRequests);
    if (keys.length === 0) throw new Error('Task asked for input without any input request');
    const reused = keys.find(key => envelope.usedInputKeys.includes(key));
    if (reused !== undefined) throw new Error(`Input request key "${reused}" was already used by this task`);
    const next: BackgroundTaskEnvelope = {
      ...envelope,
      inputRequests: result.inputRequests,
      inputResponses: {},
      usedInputKeys: [...envelope.usedInputKeys, ...keys],
    };
    const written = await storage.updateTask(
      row.id,
      { metadata: next as unknown as Record<string, unknown> },
      { expectedStatus: 'running', expectedOwnerId: this.#manager.ownerId },
    );
    if (!written) throw new Error('MCP task is no longer running here');
    if (!options?.suspend) throw new Error('Background task runtime cannot suspend this task');
    await options.suspend(result.suspendPayload);
    return undefined;
  }
}
