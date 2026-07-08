/**
 * CLI adapter for headless MastraCode runs.
 *
 * This is the only headless layer that touches the process: it parses argv,
 * reads stdin, bootstraps MastraCode via `createMastraCode`, drives `runMC`,
 * renders events/results to stdout/stderr through the pure formatters, maps the
 * result to an exit code, and owns teardown + `process.exit`.
 */
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { createMastraCode } from '../index.js';
import { setupDebugLogging } from '../utils/debug-log.js';
import { releaseAllThreadLocks } from '../utils/thread-lock.js';

import { buildParseArgsOptions, FLAGS, renderFlagUsage } from './flags.js';
import { createHumanFormatState, formatHuman, formatJsonl, renderJsonResult } from './format.js';
import { permissionModeToPolicy } from './policy.js';
import { runMC } from './run-mc.js';
import type { PermissionMode, RunMode, ThinkingLevel } from './types.js';

/** Consolidated output mode (replaces the old `--format` + `--output-format`). */
export type OutputMode = 'human' | 'json' | 'jsonl';

export interface HeadlessArgs {
  prompt?: string;
  /** Timeout in seconds (CLI surface); converted to ms before `runMC`. */
  timeout?: number;
  output: OutputMode;
  continue_: boolean;
  model?: string;
  mode?: RunMode;
  thinkingLevel?: ThinkingLevel;
  settings?: string;
  thread?: string;
  title?: string;
  cloneThread: boolean;
  resourceId?: string;
  /** Max agentic turns before the run aborts with exit code 1. */
  maxTurns?: number;
  /** Named permission mode resolving to a built-in policy. Defaults to `auto`. */
  permissionMode?: PermissionMode;
}

const parseArgsOptions = buildParseArgsOptions();

/**
 * Returns true if `argv` selects headless mode. This must agree with what
 * {@link parseHeadlessArgs} (and `runMCCli`) accept as a prompt: `--prompt`/`-p`
 * or a bare positional prompt (e.g. `mastracode "Fix the bug"`). Note that a
 * prompt piped via stdin without a flag is handled separately by the caller.
 */
export function hasHeadlessFlag(argv: string[]): boolean {
  if (argv.some(a => a === '--prompt' || a === '-p')) return true;
  try {
    const { values, positionals } = parseArgs({
      args: argv.slice(2),
      options: parseArgsOptions,
      strict: false,
      allowPositionals: true,
    });
    // A positional prompt only counts when not asking for help.
    return positionals.length > 0 && !values.help;
  } catch {
    return false;
  }
}

/**
 * Parse CLI arguments for headless mode. The flag table in `flags.ts` is the
 * single source of truth: each flag carries its own coercion/validation, so this
 * function just walks {@link FLAGS} and assembles the typed {@link HeadlessArgs}.
 */
export function parseHeadlessArgs(argv: string[]): HeadlessArgs {
  const { values, positionals } = parseArgs({
    args: argv.slice(2),
    options: parseArgsOptions,
    strict: false,
    allowPositionals: true,
  });

  // Seed defaults; per-flag values below override these.
  const args: HeadlessArgs = {
    output: 'human',
    continue_: false,
    cloneThread: false,
  };
  const sink = args as unknown as Record<string, unknown>;

  for (const flag of FLAGS) {
    if (!flag.field) continue; // e.g. --help, handled by the caller
    const raw = values[flag.key];
    if (raw === undefined) continue;

    if (flag.type === 'boolean') {
      sink[flag.field] = Boolean(raw);
    } else if (typeof raw === 'string') {
      sink[flag.field] = flag.coerce ? flag.coerce(raw) : raw;
    }
  }

  // A bare positional acts as the prompt when --prompt/-p is absent.
  if (args.prompt === undefined && positionals[0] !== undefined) {
    args.prompt = positionals[0];
  }

  if (args.continue_ && args.thread) {
    throw new Error('--continue and --thread cannot be used together');
  }

  return args;
}

export function printHeadlessUsage(): void {
  process.stdout.write(`
Usage: mastracode --prompt <text> [options]

Headless (non-interactive) mode options:
${renderFlagUsage()}

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
  1  Error, aborted, or max turns reached
  2  Timeout

Examples:
  mastracode --prompt "Fix the bug in auth.ts"
  mastracode --prompt "Add tests" --timeout 300 --output json
  mastracode --prompt "Refactor" --output jsonl
  mastracode --prompt "Review this PR" --permission-mode deny --max-turns 10
  mastracode --settings ./settings-ci.json --prompt "Run tests"
  mastracode -c --prompt "Continue where you left off"
  echo "Summarize the repo" | mastracode --prompt -
`);
}

/**
 * Headless CLI entry point: parse arguments, read stdin, initialize MastraCode,
 * run via `runMC`, render output, and exit with the mapped code.
 */
export async function runMCCli(predrainedInput?: string | null): Promise<never> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHeadlessUsage();
    process.exit(0);
  }

  let args: HeadlessArgs;
  try {
    args = parseHeadlessArgs(process.argv);
  } catch (e) {
    process.stderr.write(`Error: ${(e as Error).message}\n`);
    process.exit(1);
  }

  let prompt = args.prompt;
  if (predrainedInput !== undefined) {
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

  const boot = await createMastraCode({ settingsPath: args.settings });
  const { controller, session, mcpManager, effectiveDefaults } = boot;

  if (mcpManager?.hasServers()) {
    try {
      await mcpManager.initInBackground();
    } catch (err) {
      process.stderr.write(`Warning: MCP server initialization failed: ${(err as Error).message ?? err}\n`);
    }
  }

  setupDebugLogging();

  // Default to a non-zero exit so an unexpected throw before the run resolves
  // still surfaces as a failure to the caller / CI.
  let exitCode = 1;
  try {
    const humanState = createHumanFormatState();
    const run = runMC({
      controller,
      session,
      prompt,
      model: args.model,
      mode: args.mode,
      modeDefaults: effectiveDefaults,
      thinkingLevel: args.thinkingLevel,
      thread: { id: args.thread, continueLatest: args.continue_, clone: args.cloneThread },
      resourceId: args.resourceId,
      title: args.title,
      timeoutMs: args.timeout ? args.timeout * 1000 : undefined,
      maxTurns: args.maxTurns,
      policy: args.permissionMode ? permissionModeToPolicy(args.permissionMode) : undefined,
    });

    // Stream live events for human + jsonl modes. (json mode prints only the final object.)
    for await (const event of run) {
      if (args.output === 'human') {
        const out = formatHuman(event, humanState);
        if (out.stdout) process.stdout.write(out.stdout);
        if (out.stderr) process.stderr.write(out.stderr);
      } else if (args.output === 'jsonl') {
        process.stdout.write(JSON.stringify(formatJsonl(event)) + '\n');
      }
    }

    const result = await run.result;
    exitCode = result.exitCode;

    if (args.output === 'json') {
      process.stdout.write(renderJsonResult(result));
    } else if (args.output === 'jsonl') {
      process.stdout.write(JSON.stringify({ type: 'result', ...result }) + '\n');
    }

    if (result.status === 'timeout') {
      process.stderr.write(`\nTimeout elapsed. Aborted.\n`);
    } else if (result.error && args.output === 'human') {
      process.stderr.write(`Error: ${result.error.message}\n`);
    }
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message ?? err}\n`);
    exitCode = 1;
  } finally {
    // --- Teardown (always runs, even on a thrown error) ---
    releaseAllThreadLocks();
    const closeSignalsPubSub = (boot.signalsPubSub as { close?: () => Promise<void> | void } | undefined)?.close;
    await Promise.allSettled([
      mcpManager?.disconnect(),
      controller.getMastra()?.stopWorkers(),
      controller?.stopIntervals(),
      closeSignalsPubSub?.(),
    ]);
  }

  process.exit(exitCode);
}
