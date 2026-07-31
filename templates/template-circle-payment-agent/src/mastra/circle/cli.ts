// Adapted from Circle's agent-stack-starter-kits.
// Copyright 2026 Circle Internet Group, Inc.
// SPDX-License-Identifier: Apache-2.0

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const MAX_OUTPUT_CHARS = 10 * 1024 * 1024;

export interface CliOptions {
  json?: boolean;
  cwd?: string;
  binary?: string;
  env?: NodeJS.ProcessEnv;
  // Only safe for idempotent reads; mutating commands leave this at 0 so nothing double-pays.
  retries?: number;
  timeoutMs?: number;
}

// Applied only where `retries` is set: a mutating command is never killed on a timer, because x402
// submits the charge before the request resolves, so killing a slow payment risks a charge with no
// receipt.
export const READ_TIMEOUT_MS = (() => {
  const parsed = Number(process.env.CIRCLE_CLI_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120_000;
})();

// Failures that mean the request never got a real answer, so a read may safely retry.
const TRANSIENT_ERROR_PATTERNS = [
  'fetch failed',
  'etimedout',
  'econnreset',
  'econnrefused',
  'enotfound',
  'eai_again',
  'socket hang up',
  'network error',
  'request timed out',
  'http 429',
  'too many requests',
  'rate limit',
  'http 502',
  'http 503',
  'http 504',
];

function isTransientFailure(detail: string): boolean {
  const lower = detail.toLowerCase();
  return TRANSIENT_ERROR_PATTERNS.some(p => lower.includes(p));
}

// Node deprecation warnings, which the CLI's dependencies emit on stderr on every run.
const NODE_WARNING_LINE = /^\(node:\d+\)|^\(Use `node /;

function withoutNodeWarnings(stderr: string): string {
  return stderr
    .split('\n')
    .filter(line => !NODE_WARNING_LINE.test(line.trimStart()))
    .join('\n')
    .trim();
}

export class CircleCliError extends Error {
  constructor(
    message: string,
    readonly args: readonly string[],
    readonly stdout: string,
    readonly stderr: string,
    readonly exitCode: number | null,
  ) {
    super(message);
    this.name = 'CircleCliError';
  }
}

// One `circle` process at a time: frameworks dispatch tool calls in parallel, and two concurrent
// `services pay` runs on one wallet is a double-spend.
let cliQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = cliQueue.then(task);
  // The tail swallows the result so a command that throws does not reject the chain behind it.
  cliQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

interface CliResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

// `spawn` rather than `execFile` so stdin can be 'ignore': `execFile` leaves it an open pipe, so a
// subcommand that reads it would wait forever on input no agent is there to type.
function spawnCircle(binary: string, args: readonly string[], options: CliOptions): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, [...args], {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let overflowed = false;
    let timedOut = false;
    const watchdog = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill();
        }, options.timeoutMs)
      : undefined;

    const collect = (chunk: string, into: 'out' | 'err') => {
      if (into === 'out') stdout += chunk;
      else stderr += chunk;
      if (stdout.length + stderr.length > MAX_OUTPUT_CHARS && !overflowed) {
        overflowed = true;
        child.kill();
      }
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => collect(chunk, 'out'));
    child.stderr.on('data', (chunk: string) => collect(chunk, 'err'));

    child.on('error', err => {
      clearTimeout(watchdog);
      reject(err);
    });
    child.on('close', code => {
      clearTimeout(watchdog);
      if (overflowed) {
        reject(new Error(`circle ${args.join(' ')} produced more than ${MAX_OUTPUT_CHARS} bytes`));
        return;
      }
      if (timedOut) {
        // Phrased to match TRANSIENT_ERROR_PATTERNS so a hang retries like any transient fault.
        reject(
          new Error(`circle ${args.join(' ')} request timed out after ${Math.round((options.timeoutMs ?? 0) / 1000)}s`),
        );
        return;
      }
      resolve({ stdout, stderr, code });
    });
  });
}

// No shell, so URLs, keywords and JSON payloads pass through verbatim and shell metacharacters
// are never interpreted.
export async function runCircle(args: readonly string[], options: CliOptions = {}): Promise<string> {
  const finalArgs = options.json && !args.includes('--output') ? [...args, '--output', 'json'] : [...args];
  const binary = options.binary ?? 'circle';
  const maxAttempts = Math.max(1, (options.retries ?? 0) + 1);

  // Arm the hang watchdog only for commands the caller marked retryable. A mutating command has no
  // `retries` and so is never killed on a timer; see READ_TIMEOUT_MS.
  const spawnOptions: CliOptions = options.retries
    ? { ...options, timeoutMs: options.timeoutMs ?? READ_TIMEOUT_MS }
    : options;

  let lastError: CircleCliError | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let stdout = '';
    let stderr = '';
    let exitCode: number | null = null;
    let detail: string;
    try {
      const result = await enqueue(() => spawnCircle(binary, finalArgs, spawnOptions));
      if (result.code === 0) return result.stdout;
      ({ stdout, stderr } = result);
      exitCode = result.code;
      detail = withoutNodeWarnings(stderr) || stdout.trim() || `exited with code ${String(result.code)}`;
    } catch (err) {
      // The process never ran, so there are no streams to read.
      detail = err instanceof Error ? err.message : String(err);
    }

    lastError = new CircleCliError(
      `circle ${finalArgs.join(' ')} failed: ${detail}`,
      finalArgs,
      stdout,
      stderr,
      exitCode,
    );
    // A real CLI error (bad args, auth, validation) fails fast on the first attempt.
    if (attempt < maxAttempts && isTransientFailure(detail)) {
      await sleep(300 * 3 ** (attempt - 1));
      continue;
    }
    throw lastError;
  }
  throw lastError!;
}

export async function runCircleJson<T>(args: readonly string[], options: CliOptions = {}): Promise<T> {
  const out = await runCircle(args, { ...options, json: true });
  const trimmed = out.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch (err) {
    throw new CircleCliError(
      `Failed to parse JSON output from circle ${args.join(' ')}: ${(err as Error).message}`,
      args,
      out,
      '',
      0,
    );
  }
}
