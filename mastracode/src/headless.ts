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
  thread?: string;
  title?: string;
  cloneThread: boolean;
  resourceId?: string;
}

/** Returns true if argv contains --prompt or -p, indicating headless mode. */
export function hasHeadlessFlag(argv: string[]): boolean {
  return argv.some(a => a === '--prompt' || a === '-p');
}

const headlessOptions = {
  prompt: { type: 'string', short: 'p' },
  continue: { type: 'boolean', short: 'c', default: false },
  thread: { type: 'string', short: 't' },
  title: { type: 'string' },
  'clone-thread': { type: 'boolean', default: false },
  'resource-id': { type: 'string' },
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
  const thread = typeof values.thread === 'string' ? values.thread : undefined;
  const title = typeof values.title === 'string' ? values.title : undefined;
  const cloneThread = Boolean(values['clone-thread']);
  const resourceId = typeof values['resource-id'] === 'string' ? values['resource-id'] : undefined;

  if (values.continue && thread) {
    throw new Error('--continue and --thread cannot be used together');
  }

  return {
    prompt,
    timeout,
    format: format as 'default' | 'json',
    continue_: Boolean(values.continue),
    thread,
    title,
    cloneThread,
    resourceId,
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
  --prompt, -p <text>     The task to execute (required, or pipe via stdin)
  --continue, -c          Resume the most recent thread instead of creating a new one
  --thread, -t <id|title> Resume a specific thread by ID or title
  --title <title>         Set or rename the thread title
  --clone-thread          Clone the current thread before running (work on a copy)
  --resource-id <id>      Set the resource ID for thread scoping
  --timeout <seconds>     Exit with code 2 if not complete within timeout
  --format <type>         Output format: "default" or "json" (default: "default")

Thread behavior:
  By default, a new thread is created for each run.
  Use --continue to resume the most recent thread, or --thread to target a specific one.
  Use --clone-thread to branch off a copy before running.

Exit codes:
  0  Agent completed successfully
  1  Error or aborted
  2  Timeout

Examples:
  mastracode --prompt "Fix the bug in auth.ts"
  mastracode --prompt "Add tests" --timeout 300
  mastracode -c --prompt "Continue where you left off"
  mastracode -t "feature-auth" --prompt "Keep working on this"
  mastracode --thread abc123 --clone-thread --prompt "Try a different approach"
  mastracode --prompt "Refactor utils" --title "utils-refactor"
  mastracode --prompt "Refactor utils" --format json
  mastracode --resource-id my-project --prompt "Fix the bug"
  echo "task description" | mastracode --prompt -

Run without --prompt for the interactive TUI.
`);
}

function resolveExitCode(reason?: string): number {
  return reason === 'error' || reason === 'aborted' ? 1 : 0;
}

function autoResolve<TState extends Record<string, unknown>>(
  harness: Harness<TState>,
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

/** Resolve a thread by ID or title. Tries exact ID match first, then title. */
async function resolveThread(
  harness: Harness,
  threadIdOrTitle: string,
): Promise<{ threadId: string; matchType: 'id' | 'title' } | { error: string }> {
  const threads = await harness.listThreads();

  const byId = threads.find(t => t.id === threadIdOrTitle);
  if (byId) return { threadId: byId.id, matchType: 'id' };

  const byTitle = threads
    .filter(t => t.title === threadIdOrTitle)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  if (byTitle.length > 0) return { threadId: byTitle[0]!.id, matchType: 'title' };

  return { error: `No thread found matching "${threadIdOrTitle}"` };
}

/**
 * Run headless mode: subscribe to harness events with auto-approval,
 * optionally resume a thread, send the prompt, and wait for completion.
 *
 * Returns the exit code (0 = success, 1 = error/aborted, 2 = timeout).
 */
export async function runHeadless<TState extends Record<string, unknown>>(
  harness: Harness<TState>,
  args: HeadlessArgs & { prompt: string },
): Promise<number> {
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

  // --- Resource ID ---
  if (args.resourceId) {
    harness.setResourceId({ resourceId: args.resourceId });
    if (!emit) process.stderr.write(`[resource] ${args.resourceId}\n`);
  }

  // --- Thread selection ---
  try {
    if (args.thread) {
      const result = await resolveThread(harness, args.thread);
      if ('error' in result) {
        const msg = result.error;
        if (emit) emit({ type: 'error', error: { message: msg } });
        else process.stderr.write(`Error: ${msg}\n`);
        if (timeoutId) clearTimeout(timeoutId);
        return 1;
      }
      await harness.switchThread({ threadId: result.threadId });
      if (!emit) process.stderr.write(`[thread] resumed ${result.threadId} (matched by ${result.matchType})\n`);
    } else if (args.continue_) {
      const threads = await harness.listThreads();
      if (threads.length > 0) {
        const sorted = [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        await harness.switchThread({ threadId: sorted[0]!.id });
        if (!emit) process.stderr.write(`[continued] thread ${sorted[0]!.id}\n`);
      } else if (!emit) {
        process.stderr.write(`[info] No existing threads found, starting new thread\n`);
      }
    }
    // else: no thread selection — sendMessage will auto-create a new thread
  } catch (err) {
    const msg = `Failed to select thread: ${(err as Error).message}`;
    if (emit) emit({ type: 'error', error: { message: msg } });
    else process.stderr.write(`Error: ${msg}\n`);
    if (timeoutId) clearTimeout(timeoutId);
    return 1;
  }

  // --- Clone ---
  if (args.cloneThread) {
    try {
      const cloned = await harness.cloneThread();
      if (emit) emit({ type: 'thread_cloned', threadId: cloned.id });
      else process.stderr.write(`[cloned] thread ${cloned.id}\n`);
    } catch (err) {
      const msg = `Failed to clone thread: ${(err as Error).message}`;
      if (emit) emit({ type: 'error', error: { message: msg } });
      else process.stderr.write(`Error: ${msg}\n`);
      if (timeoutId) clearTimeout(timeoutId);
      return 1;
    }
  }

  // --- Title ---
  if (args.title) {
    try {
      await harness.renameThread({ title: args.title });
      if (!emit) process.stderr.write(`[title] "${args.title}"\n`);
    } catch (err) {
      const msg = `Failed to set thread title: ${(err as Error).message}`;
      if (emit) emit({ type: 'error', error: { message: msg } });
      else process.stderr.write(`Error: ${msg}\n`);
      if (timeoutId) clearTimeout(timeoutId);
      return 1;
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
    mcpManager.initInBackground().catch(() => {
      // Non-fatal — tools from MCP servers won't be available
    });
  }

  setupDebugLogging();
  await harness.init();

  const exitCode = await runHeadless(harness, { ...args, prompt });

  // Cleanup
  releaseAllThreadLocks();
  await Promise.allSettled([mcpManager?.disconnect(), harness?.stopHeartbeats()]);

  process.exit(exitCode);
}
