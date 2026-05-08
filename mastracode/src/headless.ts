/**
 * Headless mode helpers — pure functions extracted for testability.
 */
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';

import type { Harness, HarnessEvent, HarnessMessage } from '@mastra/core/harness';

import { setupDebugLogging } from './utils/debug-log.js';
import { releaseAllThreadLocks } from './utils/thread-lock.js';
import { createMastraCode } from './index.js';

const VALID_MODES = ['build', 'plan', 'fast'] as const;
const VALID_THINKING_LEVELS = ['off', 'low', 'medium', 'high', 'xhigh'] as const;

export interface HeadlessArgs {
  prompt?: string;
  timeout?: number;
  format: 'default' | 'json';
  outputFormat?: 'text' | 'json' | 'stream-json';
  continue_: boolean;
  model?: string;
  mode?: 'build' | 'plan' | 'fast';
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high' | 'xhigh';
  settings?: string;
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
  'output-format': { type: 'string' },
  model: { type: 'string', short: 'm' },
  mode: { type: 'string' },
  'thinking-level': { type: 'string' },
  settings: { type: 'string' },
  help: { type: 'boolean', short: 'h', default: false },
} as const;

/** Parse CLI arguments for headless mode (--prompt, --timeout, --format, --output-format, --continue, --model, --mode, --thinking-level, --settings). */
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
  const model = typeof values.model === 'string' ? values.model : undefined;

  let mode: HeadlessArgs['mode'];
  if (values.mode !== undefined) {
    const raw = String(values.mode);
    if (!(VALID_MODES as readonly string[]).includes(raw)) {
      throw new Error(`--mode must be ${VALID_MODES.map(m => `"${m}"`).join(', ')}`);
    }
    mode = raw as HeadlessArgs['mode'];
  }

  let thinkingLevel: HeadlessArgs['thinkingLevel'];
  if (values['thinking-level'] !== undefined) {
    const raw = String(values['thinking-level']);
    if (!(VALID_THINKING_LEVELS as readonly string[]).includes(raw)) {
      throw new Error(`--thinking-level must be ${VALID_THINKING_LEVELS.map(l => `"${l}"`).join(', ')}`);
    }
    thinkingLevel = raw as HeadlessArgs['thinkingLevel'];
  }

  let outputFormat: HeadlessArgs['outputFormat'];
  if (values['output-format'] !== undefined) {
    const raw = String(values['output-format']);
    if (raw !== 'text' && raw !== 'json' && raw !== 'stream-json') {
      throw new Error('--output-format must be one of: text, json, stream-json');
    }
    outputFormat = raw;
  }

  const settings = typeof values.settings === 'string' ? values.settings : undefined;
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
    outputFormat,
    continue_: Boolean(values.continue),
    model,
    mode,
    thinkingLevel,
    settings,
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
  --prompt, -p <text>           The task to execute (required, or pipe via stdin)
  --continue, -c                Resume the most recent thread instead of creating a new one
  --thread, -t <id|title>       Resume a specific thread by ID or title
  --title <title>               Set or rename the thread title
  --clone-thread                Clone the current thread before running (work on a copy)
  --resource-id <id>            Set the resource ID for thread scoping
  --timeout <seconds>           Exit with code 2 if not complete within timeout
  --format <type>               Output format: "default" or "json" (default: "default")
  --output-format <type>        Automation output: "text", "json", or "stream-json"
  --model, -m <id>              Model override (e.g., "anthropic/claude-sonnet-4-5")
  --mode {build|plan|fast}      Execution mode — defaults to "build" if omitted
  --thinking-level <level>      Thinking level: off, low, medium, high, xhigh
  --settings <path>             Path to settings.json file (default: global settings)

Thread behavior:
  By default, a new thread is created for each run.
  Use --continue to resume the most recent thread, or --thread to target a specific one.
  Use --clone-thread to branch off a copy before running.

Settings file:
  Uses the same settings.json as the interactive TUI. Pass --settings to use
  a custom settings file (e.g., settings-ci.json for CI). All model, pack,
  subagent, and OM configuration is resolved from settings at startup.

Exit codes:
  0  Agent completed successfully
  1  Error or aborted
  2  Timeout

Examples:
  mastracode --prompt "Fix the bug in auth.ts"
  mastracode --prompt "Add tests" --timeout 300
  mastracode --prompt "Fix the bug" --mode fast --thinking-level high
  mastracode --settings ./settings-ci.json --prompt "Run tests"
  mastracode -c --prompt "Continue where you left off"
  mastracode -t "feature-auth" --prompt "Keep working on this"
  mastracode --thread abc123 --clone-thread --prompt "Try a different approach"
  mastracode --prompt "Refactor utils" --title "utils-refactor"
  mastracode --prompt "Refactor utils" --format json
  mastracode --prompt "Run tests and summarize pass/fail counts" --output-format json
  mastracode --prompt "Find all TODO comments" --output-format stream-json
  mastracode --resource-id my-project --prompt "Fix the bug"
  echo "task description" | mastracode --prompt -

Piping without --prompt launches the interactive TUI with piped content
as the first message:
  cat file.txt | mastracode
  git diff | mastracode
  npm test 2>&1 | mastracode

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
      process.stderr.write(
        `[subagent:${event.forked ? 'forked:' : ''}${event.agentType}] ${truncate(event.task, 100)}\n`,
      );
      break;
    case 'subagent_end':
      if (event.isError) process.stderr.write(`[subagent error] ${truncate(event.result, 200)}\n`);
      break;
    case 'error':
      process.stderr.write(`[error] ${event.error.message}\n`);
      break;
  }
}

interface HeadlessSummary {
  text: string;
  finishReason?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  toolCalls: Array<{ id: string; name: string; args: unknown }>;
  toolResults: Array<{ id: string; name: string; result: unknown; isError: boolean }>;
  error?: { name: string; message: string; stack?: string };
  threadId?: string;
}

function createEmptySummary(): HeadlessSummary {
  return { text: '', toolCalls: [], toolResults: [] };
}

function extractAssistantText(message: HarnessMessage): string {
  return message.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('');
}

function aggregateIntoSummary(event: HarnessEvent, summary: HeadlessSummary): void {
  switch (event.type) {
    case 'message_end':
      if (event.message.role === 'assistant') {
        summary.text += extractAssistantText(event.message);
      }
      break;
    case 'tool_start':
      summary.toolCalls.push({ id: event.toolCallId, name: event.toolName, args: event.args });
      break;
    case 'tool_end': {
      const matching = summary.toolCalls.find(c => c.id === event.toolCallId);
      summary.toolResults.push({
        id: event.toolCallId,
        name: matching?.name ?? '',
        result: event.result,
        isError: event.isError,
      });
      break;
    }
    case 'usage_update':
      summary.usage = {
        inputTokens: event.usage.promptTokens,
        outputTokens: event.usage.completionTokens,
        totalTokens: event.usage.totalTokens,
      };
      break;
    case 'error':
      summary.error = {
        name: event.error.name,
        message: event.error.message,
        stack: event.error.stack,
      };
      break;
  }
}

function finalizeSummary<TState extends Record<string, unknown>>(
  summary: HeadlessSummary,
  endEvent: Extract<HarnessEvent, { type: 'agent_end' }>,
  harness: Harness<TState>,
): void {
  summary.finishReason = endEvent.reason;
  summary.threadId = harness.getCurrentThreadId() ?? undefined;
}

/** Resolve a thread by ID or title. Tries exact ID match first, then title. */
async function resolveThread<TState extends Record<string, unknown>>(
  harness: Harness<TState>,
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
  effectiveDefaults?: Record<string, string>,
): Promise<number> {
  const outputFormat = args.outputFormat;
  const emit =
    outputFormat === 'stream-json' || (!outputFormat && args.format === 'json')
      ? (data: Record<string, unknown>) => process.stdout.write(JSON.stringify(data) + '\n')
      : null;
  const summary = outputFormat === 'json' ? createEmptySummary() : null;
  let textBuffer: string | null = outputFormat === 'text' ? '' : null;

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

  function failEarly(msg: string): 1 {
    if (emit) emit({ type: 'error', error: { message: msg } });
    else process.stderr.write(`Error: ${msg}\n`);
    if (timeoutId) clearTimeout(timeoutId);
    return 1;
  }

  // --- Pre-flight checks (before subscribing to events) ---

  // --- Resolve model ---
  if (args.model && args.mode) {
    if (emit) {
      emit({ type: 'warning', message: '--model overrides --mode, ignoring --mode' });
    } else {
      process.stderr.write('Warning: --model overrides --mode, ignoring --mode\n');
    }
  }

  if (args.model) {
    // Highest priority: explicit --model flag
    const available = await harness.listAvailableModels();
    const match = available.find(m => m.id === args.model);
    if (!match) {
      return failEarly(`Unknown model: "${args.model}"`);
    }
    if (!match.hasApiKey) {
      const keyHint = match.apiKeyEnvVar ? ` Set ${match.apiKeyEnvVar} to use this model.` : '';
      return failEarly(`Model "${args.model}" has no API key configured.${keyHint}`);
    }
    await harness.switchModel({ modelId: args.model });
    if (!emit) process.stderr.write(`[model] ${args.model}\n`);
  } else if (args.mode) {
    // --mode flag: look up model from effectiveDefaults (resolved from settings at startup)
    const modelId = effectiveDefaults?.[args.mode];
    if (modelId) {
      const available = await harness.listAvailableModels();
      const match = available.find(m => m.id === modelId);
      if (!match) {
        return failEarly(`Unknown model "${modelId}" configured for mode "${args.mode}"`);
      }
      if (!match.hasApiKey) {
        const keyHint = match.apiKeyEnvVar ? ` Set ${match.apiKeyEnvVar} to use this model.` : '';
        return failEarly(`Model "${modelId}" (mode: ${args.mode}) has no API key configured.${keyHint}`);
      }
      await harness.switchModel({ modelId });
      if (!emit) process.stderr.write(`[model] ${modelId} (mode: ${args.mode})\n`);
    } else {
      const warnMsg = `--mode ${args.mode} has no configured model, using default`;
      if (emit) emit({ type: 'warning', message: warnMsg });
      else process.stderr.write(`Warning: ${warnMsg}\n`);
    }
  }

  // --- Resolve thinking level ---
  if (args.thinkingLevel) {
    await harness.setState({ thinkingLevel: args.thinkingLevel } as unknown as Partial<TState>);
    if (!emit) process.stderr.write(`[thinking] ${args.thinkingLevel}\n`);
  }

  // --- Subscribe and send ---
  // Subscription is set up after preflight checks (model switching, thinking level) so that
  // early-exit failures don't leave a dangling subscriber. The subscriber only handles
  // runtime events (auto-resolution, streaming, agent_end).

  const streamCtx = { lastTextLength: 0 };

  const done = new Promise<number>(resolve => {
    harness.subscribe(event => {
      const result = autoResolve(harness, event);
      if (result.resolved) {
        if (emit) emit(result.json);
        else if (!outputFormat) process.stderr.write(result.label + '\n');
        return;
      }

      // Aggregate into accumulators for text / json modes
      if (summary) aggregateIntoSummary(event, summary);
      if (textBuffer !== null && event.type === 'message_end' && event.message.role === 'assistant') {
        textBuffer += extractAssistantText(event.message);
      }

      if (event.type === 'agent_end') {
        if (summary) {
          finalizeSummary(summary, event, harness);
          process.stdout.write(JSON.stringify(summary) + '\n');
        } else if (textBuffer !== null) {
          process.stdout.write(textBuffer);
          if (!textBuffer.endsWith('\n')) process.stdout.write('\n');
        } else if (emit) {
          emit({ ...event });
        }
        resolve(resolveExitCode(event.reason));
        return;
      }

      if (emit) {
        emit({ ...event });
      } else if (!outputFormat) {
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
export async function headlessMain(predrainedInput?: string | null): Promise<never> {
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
  if (predrainedInput !== undefined) {
    // Stdin was already drained by the caller (e.g. TTY reopen failed after pipe drain)
    prompt = predrainedInput ?? '';
  } else if (prompt === '-' || (!prompt && !process.stdin.isTTY)) {
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

  if (args.settings && !existsSync(args.settings)) {
    process.stderr.write(`Error: Settings file not found: ${args.settings}\n`);
    process.exit(1);
  }

  const result = await createMastraCode({ settingsPath: args.settings });
  const { harness, mcpManager, effectiveDefaults } = result;

  if (mcpManager?.hasServers()) {
    mcpManager.initInBackground().catch(err => {
      process.stderr.write(`Warning: MCP server initialization failed: ${(err as Error).message ?? err}\n`);
    });
  }

  setupDebugLogging();
  await harness.init();

  const exitCode = await runHeadless(harness, { ...args, prompt }, effectiveDefaults);

  // Cleanup
  releaseAllThreadLocks();
  await Promise.allSettled([mcpManager?.disconnect(), harness?.stopHeartbeats()]);

  process.exit(exitCode);
}
