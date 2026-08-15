/**
 * Write-path wrapper around the first-party taskmarket CLI.
 *
 * The CLI owns the wallet, x402 payments, and EIP-191 signatures; this
 * integration never handles private keys. Creating a task requires explicit
 * confirmation and enforces the TASKMARKET_MAX_SPEND_USDC ceiling (default
 * 10 USDC); the configured ceiling always wins over the tool-call cap.
 * A payment whose settlement status is unknown is never retried.
 */

import { execFile, execSync } from 'node:child_process';
import path from 'node:path';

const DEFAULT_MAX_SPEND_USDC = 10;
const CREATE_TASK_TIMEOUT_MS = 120_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionalString = (value: unknown): string | undefined => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > 0 ? text : undefined;
};

let cachedCliEntry: string | undefined;

/**
 * Resolve the first-party taskmarket CLI entry point. The CLI owns the
 * wallet, x402 payments, and signatures; integrations must wrap it via
 * subprocess instead of reimplementing the protocol or handling keys.
 */
export function taskmarketCliEntry(): string {
  if (cachedCliEntry) return cachedCliEntry;
  const globalRoot = execSync('npm root -g', {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  cachedCliEntry = path.join(
    globalRoot,
    '@lucid-agents',
    'taskmarket',
    'dist',
    'index.js',
  );
  return cachedCliEntry;
}

const execFileAsync = (
  file: string,
  args: ReadonlyArray<string>,
  options: { timeout: number; encoding: 'utf8'; windowsHide: boolean },
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    execFile(file, [...args], options, (error, stdout, stderr) => {
      if (error) {
        reject(
          Object.assign(error, {
            ...(stdout ? { stdout } : {}),
            ...(stderr ? { stderr } : {}),
          }),
        );
        return;
      }
      resolve({ stdout: stdout ?? '', stderr: stderr ?? '' });
    });
  });

async function runTaskmarketCli(
  args: ReadonlyArray<string>,
  timeoutMs: number,
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  try {
    const { stdout, stderr = '' } = await execFileAsync(
      process.execPath,
      [taskmarketCliEntry(), ...args],
      { timeout: timeoutMs, encoding: 'utf8', windowsHide: true },
    );
    return { stdout, stderr };
  } catch (error) {
    const err = error as {
      code?: string;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    if (err.code === 'ENOENT') {
      throw new Error(
        'The taskmarket CLI is not installed. Install it with: npm install -g @lucid-agents/taskmarket',
      );
    }
    if (err.code === 'ETIMEDOUT') {
      throw new Error(
        `The taskmarket CLI timed out after ${Math.round(timeoutMs / 1000)} seconds. ` +
          'The settlement status is unknown. Do NOT retry the payment; verify on Taskmarket whether the task was created before taking any further action.',
      );
    }
    const stderrText = String(err.stderr ?? '').trim();
    if (stderrText) {
      let pending = false;
      try {
        const envelope = JSON.parse(stderrText) as unknown;
        if (isRecord(envelope) && envelope.pending === true) {
          pending = true;
        }
      } catch {
        // not a JSON envelope; report stderr as-is
      }
      if (pending) {
        throw new Error(
          'The taskmarket CLI reported an in-flight write with unknown settlement. Do NOT retry the payment; verify the task on Taskmarket before taking any further action.',
        );
      }
      throw new Error(`The taskmarket CLI failed: ${stderrText}`);
    }
    throw new Error(`The taskmarket CLI failed: ${err.message ?? 'unknown error'}`);
  }
}

export interface CreateTaskInput {
  description: string;
  rewardUsdc: number;
  durationHours: number;
  maxSpendUsdc?: number;
  confirmation: boolean;
}

export interface CreateTaskResult {
  status: 'requires_confirmation' | 'submitted';
  taskId?: string;
  plan: Record<string, unknown>;
  message?: string;
}

export async function createTask(input: CreateTaskInput): Promise<CreateTaskResult> {
  const envMax = Number(process.env.TASKMARKET_MAX_SPEND_USDC ?? '');
  const envCeiling =
    Number.isFinite(envMax) && envMax > 0 ? envMax : DEFAULT_MAX_SPEND_USDC;
  // The configured ceiling always wins: the tool-call cap can only lower it,
  // never raise it (hard spending gate).
  const maxSpendUsdc = Math.min(input.maxSpendUsdc ?? envCeiling, envCeiling);

  const plan: Record<string, unknown> = {
    description: input.description,
    rewardUsdc: input.rewardUsdc,
    durationHours: input.durationHours,
    network: 'base',
    maxSpendUsdc,
  };

  if (!input.confirmation) {
    return {
      status: 'requires_confirmation',
      plan,
      message:
        'Creating this task spends real USDC on the Base network from the wallet managed by the taskmarket CLI. Call this tool again with confirmation: true to proceed.',
    };
  }

  if (input.rewardUsdc > maxSpendUsdc) {
    throw new Error(
      `Reward of ${input.rewardUsdc} USDC exceeds the spending limit of ${maxSpendUsdc} USDC (TASKMARKET_MAX_SPEND_USDC). Refusing to create the task.`,
    );
  }

  const args = [
    'task',
    'create',
    '--description',
    input.description,
    '--reward',
    String(input.rewardUsdc),
    '--duration',
    String(input.durationHours),
  ];
  const { stdout, stderr } = await runTaskmarketCli(args, CREATE_TASK_TIMEOUT_MS);

  let taskId: string | undefined;
  try {
    const envelope = JSON.parse(stdout) as unknown;
    if (isRecord(envelope) && envelope.ok === true && isRecord(envelope.data)) {
      taskId = optionalString(envelope.data.taskId ?? envelope.data.id);
    }
  } catch {
    // fall through to the pending/error path below
  }
  if (!taskId) {
    let pending = false;
    try {
      const errorEnvelope = JSON.parse(stderr) as unknown;
      if (isRecord(errorEnvelope) && errorEnvelope.pending === true) {
        pending = true;
      }
    } catch {
      // not a JSON envelope; report stderr as-is
    }
    if (pending) {
      throw new Error(
        'The taskmarket CLI reported an in-flight write with unknown settlement. Do NOT retry the payment; verify the task on Taskmarket before taking any further action.',
      );
    }
    throw new Error(
      `The taskmarket CLI did not return a created task ID. stderr: ${stderr.trim() || '(empty)'}`,
    );
  }

  return { status: 'submitted', taskId, plan };
}
