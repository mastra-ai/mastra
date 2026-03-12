/**
 * Headless mode helpers — pure functions extracted for testability.
 */
import { parseArgs } from 'node:util';

import type { Harness, HarnessEvent } from '@mastra/core/harness';

// Imported from local modules
import { setupDebugLogging } from './utils/debug-log.js';
import { releaseAllThreadLocks } from './utils/thread-lock.js';
import { createMastraCode } from './index.js';

export interface HeadlessArgs {
  prompt?: string;
  timeout?: number;
  format: 'default' | 'json';
  continue_: boolean;
}

/** Returns true if argv contains --prompt or -p, indicating headless mode. */
export function hasHeadlessFlag(argv: string[]): boolean {
  return argv.some(a => a === '--prompt' || a === '-p');
}

const headlessOptions = {
  prompt: { type: 'string', short: 'p' },
  continue: { type: 'boolean', short: 'c', default: false },
  timeout: { type: 'string' }, // parsed to number after validation
  format: { type: 'string', default: 'default' },
  help: { type: 'boolean', short: 'h', default: false },
} as const;

/** Parse CLI arguments for headless mode (--prompt, --timeout, --format, --continue). */
export function parseHeadlessArgs(argv: string[]): HeadlessArgs {
  const { values, positionals } = parseArgs({
    args: argv.slice(2),
    options: headlessOptions,
    strict: false,
    allowPositionals: true,
  });

  const format = String(values.format ?? 'default');
  if (format !== 'default' && format !== 'json') {
    throw new Error('--format must be "default" or "json"');
  }

  let timeout: number | undefined;
  if (values.timeout !== undefined) {
    const raw = String(values.timeout);
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error('--timeout must be a positive integer');
    }
    timeout = parsed;
  }

  const prompt = typeof values.prompt === 'string' ? values.prompt : positionals[0];

  return {
    prompt,
    timeout,
    format: format as 'default' | 'json',
    continue_: Boolean(values.continue),
  };
}

/** Truncate a string to `max` characters, appending "..." if truncated. */
export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}

export function printHeadlessUsage(): void {
  process.stdout.write(`
Usage: mastracode --prompt <text> [options]

Headless (non-interactive) mode options:
  --prompt, -p <text>   The task to execute (required, or pipe via stdin)
  --continue, -c        Resume the most recent thread instead of creating a new one
  --timeout <seconds>   Exit with code 2 if not complete within timeout
  --format <type>       Output format: "default" or "json" (default: "default")

Exit codes:
  0  Agent completed successfully
  1  Error or aborted
  2  Timeout

Examples:
  mastracode --prompt "Fix the bug in auth.ts"
  mastracode --prompt "Add tests" --timeout 300
  mastracode -c --prompt "Continue where you left off"
  mastracode --prompt "Refactor utils" --format json
  echo "task description" | mastracode --prompt -

Run without --prompt for the interactive TUI.
`);
}

function resolveExitCode(reason?: string): number {
  return reason === 'error' || reason === 'aborted' ? 1 : 0;
}

function autoResolve(
  harness: Harness,
  event: HarnessEvent,
): { resolved: true; label: string; json: Record<string, unknown> } | { resolved: false } {
  switch (event.type) {
    case 'sandbox_access_request': {
      harness.respondToQuestion({ questionId: event.questionId, answer: 'Yes' });
      return { resolved: true, label: `[auto-approved sandbox] ${event.path}`, json: { ...event, autoApproved: true } };
    }
    case 'tool_approval_required': {
      harness.respondToToolApproval({ decision: 'approve' });
      return { resolved: true, label: `[auto-approved] ${event.toolName}`, json: { ...event, autoApproved: true } };
    }
    case 'ask_question': {
      harness.respondToQuestion({
        questionId: event.questionId,
        answer: 'Proceed with your best judgment. Do not ask further questions.',
      });
      return {
        resolved: true,
        label: `[auto-answered] ${truncate(event.question, 100)}`,
        json: { ...event, autoAnswered: true },
      };
    }
    case 'plan_approval_required': {
      void harness.respondToPlanApproval({ planId: event.planId, response: { action: 'approved' } });
      return { resolved: true, label: `[auto-approved plan] ${event.title}`, json: { ...event, autoApproved: true } };
    }
    default:
      return { resolved: false };
  }
}

function formatDefault(event: HarnessEvent, ctx: { lastTextLength: number }): void {
  switch (event.type) {
    case 'agent_start':
      ctx.lastTextLength = 0;
      break;
    case 'message_update': {
      const fullText = event.message.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(p => p.text)
        .join('');
      if (fullText.length > ctx.lastTextLength) {
        process.stdout.write(fullText.slice(ctx.lastTextLength));
        ctx.lastTextLength = fullText.length;
      }
      break;
    }
    case 'message_end':
      ctx.lastTextLength = 0;
      process.stdout.write('\n');
      break;
    case 'tool_start':
      process.stderr.write(`[tool] ${event.toolName}\n`);
      break;
    case 'tool_end':
      if (event.isError) process.stderr.write(`[tool error] ${truncate(String(event.result), 200)}\n`);
      break;
    case 'shell_output':
      process.stderr.write(event.output);
      break;
    case 'subagent_start':
      process.stderr.write(`[subagent:${event.agentType}] ${truncate(event.task, 100)}\n`);
      break;
    case 'subagent_end':
      if (event.isError) process.stderr.write(`[subagent error] ${truncate(event.result, 200)}\n`);
      break;
    case 'error':
      process.stderr.write(`[error] ${event.error.message}\n`);
      break;
  }
}

/**
 * Run headless mode: subscribe to harness events with auto-approval,
 * optionally resume a thread, send the prompt, and wait for completion.
 *
 * Returns the exit code (0 = success, 1 = error/aborted, 2 = timeout).
 */
export async function runHeadless(harness: Harness, args: HeadlessArgs & { prompt: string }): Promise<number> {
  const emit =
    args.format === 'json'
      ? (data: Record<string, unknown>) => process.stdout.write(JSON.stringify(data) + '\n')
      : null;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  if (args.timeout) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      if (emit) {
        emit({ type: 'timeout', seconds: args.timeout });
      } else {
        process.stderr.write(`\nTimeout: ${args.timeout}s elapsed. Aborting.\n`);
      }
      harness.abort();
    }, args.timeout * 1000);
  }

  const streamCtx = { lastTextLength: 0 };

  const done = new Promise<number>(resolve => {
    harness.subscribe(event => {
      const result = autoResolve(harness, event);
      if (result.resolved) {
        if (emit) emit(result.json);
        else process.stderr.write(result.label + '\n');
        return;
      }

      if (event.type === 'agent_end') {
        if (emit) emit({ ...event });
        resolve(resolveExitCode(event.reason));
        return;
      }

      if (emit) {
        emit({ ...event });
      } else {
        formatDefault(event, streamCtx);
      }
    });
  });

  if (args.continue_) {
    const threads = await harness.listThreads();
    if (threads.length > 0) {
      const sorted = [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      await harness.switchThread({ threadId: sorted[0]!.id });
      if (!emit) process.stderr.write(`[continued] thread ${sorted[0]!.id}\n`);
    } else if (!emit) {
      process.stderr.write(`[info] No existing threads found, starting new thread\n`);
    }
  }

  await harness.sendMessage({ content: args.prompt });

  const exitCode = await done;
  if (timeoutId) clearTimeout(timeoutId);
  return timedOut ? 2 : exitCode;
}

/**
 * Headless mode main entry point: parse arguments, read stdin, initialize
 * MastraCode, and run headless mode.
 */
export async function headlessMain(): Promise<never> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHeadlessUsage();
    process.exit(0);
  }

  let args;
  try {
    args = parseHeadlessArgs(process.argv);
  } catch (e) {
    process.stderr.write(`Error: ${(e as Error).message}\n`);
    process.exit(1);
  }

  let prompt = args.prompt;
  if (prompt === '-' || (!prompt && !process.stdin.isTTY)) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    prompt = Buffer.concat(chunks).toString('utf-8').trim();
  }

  if (!prompt) {
    printHeadlessUsage();
    process.stderr.write('Error: --prompt is required (or pipe via stdin)\n');
    process.exit(1);
  }

  const result = await createMastraCode({ initialState: { yolo: true } });
  const { harness, mcpManager } = result;

  if (mcpManager?.hasServers()) {
    await mcpManager.init();
  }

  setupDebugLogging();
  await harness.init();

  const exitCode = await runHeadless(harness, { ...args, prompt });

  // Cleanup
  releaseAllThreadLocks();
  await Promise.allSettled([mcpManager?.disconnect(), harness?.stopHeartbeats()]);

  process.exit(exitCode);
}
