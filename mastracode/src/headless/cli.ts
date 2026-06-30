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

import { createHumanFormatState, formatHuman, formatJsonl, renderJsonResult } from './format.js';
import { permissionModeToPolicy } from './policy.js';
import { runMC } from './run-mc.js';
import type { PermissionMode, RunMode, ThinkingLevel } from './types.js';
import { VALID_MODES, VALID_PERMISSION_MODES, VALID_THINKING_LEVELS } from './types.js';

/** Consolidated output mode (replaces the old `--format` + `--output-format`). */
export type OutputMode = 'human' | 'json' | 'jsonl';
const VALID_OUTPUTS = ['human', 'json', 'jsonl'] as const;

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
  'max-turns': { type: 'string' }, // parsed to number after validation
  'permission-mode': { type: 'string' },
  output: { type: 'string', short: 'o' },
  model: { type: 'string', short: 'm' },
  mode: { type: 'string' },
  'thinking-level': { type: 'string' },
  settings: { type: 'string' },
  help: { type: 'boolean', short: 'h', default: false },
} as const;

/**
 * Parse CLI arguments for headless mode. Output is controlled by a single
 * `--output <human|json|jsonl>` flag (default `human`).
 */
export function parseHeadlessArgs(argv: string[]): HeadlessArgs {
  const { values, positionals } = parseArgs({
    args: argv.slice(2),
    options: headlessOptions,
    strict: false,
    allowPositionals: true,
  });

  let output: OutputMode = 'human';
  if (values.output !== undefined) {
    const raw = String(values.output);
    if (!(VALID_OUTPUTS as readonly string[]).includes(raw)) {
      throw new Error('--output must be one of: human, json, jsonl');
    }
    output = raw as OutputMode;
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

  let maxTurns: number | undefined;
  if (values['max-turns'] !== undefined) {
    const raw = String(values['max-turns']);
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error('--max-turns must be a positive integer');
    }
    maxTurns = parsed;
  }

  let permissionMode: PermissionMode | undefined;
  if (values['permission-mode'] !== undefined) {
    const raw = String(values['permission-mode']);
    if (!(VALID_PERMISSION_MODES as readonly string[]).includes(raw)) {
      throw new Error(`--permission-mode must be ${VALID_PERMISSION_MODES.map(m => `"${m}"`).join(', ')}`);
    }
    permissionMode = raw as PermissionMode;
  }

  const prompt = typeof values.prompt === 'string' ? values.prompt : positionals[0];
  const model = typeof values.model === 'string' ? values.model : undefined;

  let mode: RunMode | undefined;
  if (values.mode !== undefined) {
    const raw = String(values.mode);
    if (!(VALID_MODES as readonly string[]).includes(raw)) {
      throw new Error(`--mode must be ${VALID_MODES.map(m => `"${m}"`).join(', ')}`);
    }
    mode = raw as RunMode;
  }

  let thinkingLevel: ThinkingLevel | undefined;
  if (values['thinking-level'] !== undefined) {
    const raw = String(values['thinking-level']);
    if (!(VALID_THINKING_LEVELS as readonly string[]).includes(raw)) {
      throw new Error(`--thinking-level must be ${VALID_THINKING_LEVELS.map(l => `"${l}"`).join(', ')}`);
    }
    thinkingLevel = raw as ThinkingLevel;
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
    output,
    continue_: Boolean(values.continue),
    model,
    mode,
    thinkingLevel,
    settings,
    thread,
    title,
    cloneThread,
    resourceId,
    maxTurns,
    permissionMode,
  };
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
  --max-turns <n>               Abort after N agentic turns (exit code 1)
  --permission-mode <mode>      How tool approvals/suspensions resolve:
                                  auto   approve everything (default)
                                  deny   refuse approvals, abort on suspension
  --output, -o <mode>           Output mode: "human" (default), "json", or "jsonl"
                                  human  streaming text to stdout, activity to stderr
                                  json   single final JSON object (text, usage, tools)
                                  jsonl  newline-delimited JSON event stream
  --model, -m <id>              Model override (e.g., a provider/model id)
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

  // --- Teardown ---
  releaseAllThreadLocks();
  const closeSignalsPubSub = (boot.signalsPubSub as { close?: () => Promise<void> | void } | undefined)?.close;
  await Promise.allSettled([
    mcpManager?.disconnect(),
    controller.getMastra()?.stopWorkers(),
    controller?.stopHeartbeats(),
    closeSignalsPubSub?.(),
  ]);

  process.exit(result.exitCode);
}
