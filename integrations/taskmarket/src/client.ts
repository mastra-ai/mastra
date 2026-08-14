import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

import { isRecord, isString } from './guards.js';

const execFileAsync = promisify(execFileCallback);

/**
 * Base Mainnet chain id and USDC contract used by Taskmarket production.
 * See https://docs.taskmarket.dev/reference/network for the canonical table.
 */
export const TASKMARKET_BASE_CHAIN_ID = 8453;
export const TASKMARKET_BASE_USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const TASKMARKET_WEB_ROOT = 'https://taskmarket.dev';

export type TaskmarketClientOptions = {
  /**
   * Path to the `taskmarket` CLI binary. Falls back to the `TASKMARKET_CLI_PATH`
   * environment variable, then to `taskmarket` on `PATH`.
   */
  cliPath?: string;
  /**
   * Extra environment variables merged over `process.env` for every CLI
   * invocation (for example `TASKMARKET_API_URL` to select a backend).
   */
  env?: Record<string, string>;
  /**
   * Per-invocation timeout in milliseconds. Defaults to 60_000. Paid writes
   * default to 120_000 because the x402 flow settles two on-chain
   * transactions.
   */
  timeoutMs?: number;
};

export type TaskmarketEnvelope<T> = {
  ok: true;
  data: T;
  idempotencyKey?: string;
};

export type TaskmarketErrorEnvelope = {
  ok: false;
  error: string;
  status?: number;
  idempotencyKey?: string;
  pending?: boolean;
  reason?: string;
  intentId?: string;
  intentStatus?: string;
  [key: string]: unknown;
};

/**
 * Thrown when the Taskmarket CLI reports a failure, exits non-zero, times out,
 * or produces output that cannot be interpreted.
 *
 * `timedOut` marks an ambiguous outcome: the command may still be settling
 * on-chain. A timed-out paid write must never be retried automatically.
 */
export class TaskmarketCliError extends Error {
  readonly exitCode: number | null;
  readonly status?: number;
  readonly idempotencyKey?: string;
  readonly pending?: boolean;
  readonly reason?: string;
  readonly intentId?: string;
  readonly timedOut: boolean;

  constructor(
    message: string,
    fields: {
      exitCode?: number | null;
      status?: number;
      idempotencyKey?: string;
      pending?: boolean;
      reason?: string;
      intentId?: string;
      timedOut?: boolean;
    } = {},
  ) {
    super(message);
    this.name = 'TaskmarketCliError';
    this.exitCode = fields.exitCode ?? null;
    this.status = fields.status;
    this.idempotencyKey = fields.idempotencyKey;
    this.pending = fields.pending;
    this.reason = fields.reason;
    this.intentId = fields.intentId;
    this.timedOut = fields.timedOut ?? false;
  }
}

export type TaskmarketTask = {
  id: string;
  requester?: string;
  description?: string;
  mode?: string;
  status?: string;
  phase?: string | null;
  reward?: string;
  netReward?: string | null;
  platformFeeBps?: number | null;
  expiryTime?: string | null;
  submissionWindowOpen?: boolean | null;
  submissionCount?: number;
  submissionVisibility?: string | null;
  taskVisibility?: string | null;
  tags?: string[] | null;
  createdAt?: string | null;
  maxPrice?: string | null;
  pendingActions?: unknown[] | null;
  [key: string]: unknown;
};

export type TaskmarketSubmission = {
  id: string;
  taskId?: string;
  workerAddress?: string;
  submittedAt?: string | null;
  rejectedAt?: string | null;
  deliverableHash?: string | null;
  submitTxHash?: string | null;
  workerAgentId?: string | null;
  [key: string]: unknown;
};

export type TaskmarketDeposit = {
  address: string;
  network: string;
  chainId: number;
  currency: string;
  usdcContract: string;
};

export type TaskmarketBalance = {
  address: string;
  balanceBaseUnits: string;
  balanceUsdc: string;
};

export type TaskmarketCreateResult = {
  taskId: string;
  idempotencyKey?: string;
};

function isOkEnvelope(value: unknown): value is TaskmarketEnvelope<unknown> {
  return isRecord(value) && value.ok === true;
}

function isErrorEnvelope(value: unknown): value is TaskmarketErrorEnvelope {
  return isRecord(value) && value.ok === false;
}

function parseEnvelopeLine(line: string): unknown {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{')) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function lastEnvelope(lines: string[]): unknown {
  for (let i = lines.length - 1; i >= 0; i--) {
    const parsed = parseEnvelopeLine(lines[i]!);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  return undefined;
}

function pickErrorEnvelope(lines: string[]): TaskmarketErrorEnvelope | undefined {
  const envelope = lastEnvelope(lines);
  if (isErrorEnvelope(envelope)) {
    return envelope;
  }
  return undefined;
}

/**
 * Runs the first-party Taskmarket CLI and parses its JSON envelope. The CLI
 * prints `{ "ok": true, "data": ... }` on stdout and
 * `{ "ok": false, "error": ... }` (with optional `status`, `idempotencyKey`,
 * `pending`, `reason`, `intentId`) on stderr with exit code 1.
 *
 * The CLI owns the wallet, signatures, artifact uploads, legal-acceptance
 * receipts, and the x402 payment flow. This client never touches keys.
 */
export class TaskmarketClient {
  private readonly cliPath: string;
  private readonly env: Record<string, string>;
  private readonly timeoutMs: number;

  constructor(options: TaskmarketClientOptions = {}) {
    this.cliPath = options.cliPath ?? process.env.TASKMARKET_CLI_PATH ?? 'taskmarket';
    this.env = options.env ?? {};
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  /** Executes the CLI and returns the `data` payload of a success envelope. */
  async run(
    args: string[],
    opts: { timeoutMs?: number; env?: Record<string, string> } = {},
  ): Promise<{ data: unknown; idempotencyKey?: string }> {
    const timeoutMs = opts.timeoutMs ?? this.timeoutMs;
    const env = { ...process.env, ...this.env, ...opts.env } as Record<string, string>;

    let result: { stdout: string; stderr: string };
    let timedOut = false;
    let exitCode: number | null = null;
    try {
      result = await execFileAsync(this.cliPath, args, {
        env,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      });
    } catch (error) {
      const err = error as NodeJS.ErrnoException & {
        killed?: boolean;
        stdout?: string;
        stderr?: string;
        code?: string | number;
      };
      exitCode = typeof err.code === 'number' ? err.code : null;
      timedOut =
        Boolean(err.killed) || err.code === 'ETIMEDOUT' || String(err.message).includes('timeout');
      result = {
        stdout: typeof err.stdout === 'string' ? err.stdout : '',
        stderr: typeof err.stderr === 'string' ? err.stderr : '',
      };
      if (timedOut) {
        throw new TaskmarketCliError(
          `taskmarket ${args.join(' ')} timed out after ${timeoutMs}ms; the outcome is unknown and may still be settling on-chain - do not retry automatically, re-check the task status instead`,
          { exitCode: null, timedOut: true },
        );
      }
    }

    const stdoutLines = result.stdout.split('\n');
    const stderrLines = result.stderr.split('\n');

    const success = lastEnvelope(stdoutLines);
    if (isOkEnvelope(success)) {
      return { data: success.data, idempotencyKey: success.idempotencyKey };
    }

    const failure = pickErrorEnvelope(stderrLines) ?? pickErrorEnvelope(stdoutLines);
    if (failure !== undefined) {
      const details =
        failure.status !== undefined
          ? ` (status ${failure.status})`
          : failure.idempotencyKey !== undefined
            ? ` (idempotencyKey ${failure.idempotencyKey})`
            : '';
      const pendingHint =
        failure.pending === true
          ? ' The write is still in flight and may succeed; re-check status before any retry.'
          : '';
      throw new TaskmarketCliError(
        `taskmarket ${args.join(' ')} failed${details}: ${failure.error}${pendingHint}`,
        {
          exitCode,
          status: failure.status,
          idempotencyKey: failure.idempotencyKey,
          pending: failure.pending,
          reason: failure.reason,
          intentId: failure.intentId,
        },
      );
    }

    const stderrTail = result.stderr.trim().slice(0, 500);
    throw new TaskmarketCliError(
      `taskmarket ${args.join(' ')} exited with code ${exitCode ?? 'unknown'} without a parsable JSON envelope${stderrTail ? `: ${stderrTail}` : ''}`,
      { exitCode },
    );
  }

  async getTask(taskId: string): Promise<TaskmarketTask> {
    const { data } = await this.run(['task', 'get', taskId]);
    return data as TaskmarketTask;
  }

  async submissions(taskId: string): Promise<TaskmarketSubmission[]> {
    const { data } = await this.run(['task', 'submissions', taskId]);
    return data as TaskmarketSubmission[];
  }

  async deposit(): Promise<TaskmarketDeposit> {
    const { data } = await this.run(['deposit']);
    return data as TaskmarketDeposit;
  }

  async balance(address?: string): Promise<TaskmarketBalance> {
    const args = address ? ['wallet', 'balance', '--address', address] : ['wallet', 'balance'];
    const { data } = await this.run(args);
    return data as TaskmarketBalance;
  }

  async walletAddress(): Promise<string> {
    const { data } = await this.run(['address']);
    const record = isRecord(data) ? data : {};
    const address = record.address;
    if (!isString(address)) {
      throw new TaskmarketCliError('taskmarket address returned no wallet address');
    }
    return address;
  }

  async legalStatus(): Promise<unknown> {
    const { data } = await this.run(['legal', 'status']);
    return data;
  }

  /**
   * Creates a task. `createArgs` are the CLI arguments produced by the
   * integration's validation layer. The write is paid (the reward amount in
   * USDC is escrowed) and may take a while because the x402 flow settles two
   * on-chain transactions.
   */
  async createTask(createArgs: string[]): Promise<TaskmarketCreateResult> {
    const { data, idempotencyKey } = await this.run(['task', 'create', ...createArgs], {
      timeoutMs: 120_000,
    });
    const record = isRecord(data) ? data : {};
    const taskId = record.taskId;
    if (!isString(taskId)) {
      throw new TaskmarketCliError(
        `taskmarket task create returned no taskId${idempotencyKey !== undefined ? ` (idempotencyKey ${idempotencyKey})` : ''}`,
        { idempotencyKey },
      );
    }
    return { taskId, idempotencyKey };
  }
}

export function taskmarketTaskUrl(taskId: string): string {
  return `${TASKMARKET_WEB_ROOT}/tasks/${taskId}`;
}
