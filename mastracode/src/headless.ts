/**
 * Headless mode helpers — pure functions extracted for testability.
 */
import { parseArgs } from 'node:util';

import type { Harness, HarnessEvent } from '@mastra/core/harness';

// Imported from local modules
import { loadHeadlessConfig, resolveProfile, VALID_MODES, VALID_THINKING_LEVELS } from './headless-config.js';
import type { HeadlessConfig, HeadlessProfileConfig } from './headless-config.js';
import { setupDebugLogging } from './utils/debug-log.js';
import { releaseAllThreadLocks } from './utils/thread-lock.js';
import { createMastraCode } from './index.js';

export interface PackContext {
  builtinPacks: Array<{ id: string; models: Record<string, string> }>;
  builtinOmPacks: Array<{ id: string; modelId: string }>;
}

export interface HeadlessArgs {
  prompt?: string;
  timeout?: number;
  format: 'default' | 'json';
  continue_: boolean;
  model?: string;
  mode?: 'build' | 'plan' | 'fast';
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high' | 'xhigh';
  config?: string;
  profile?: string;
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
  model: { type: 'string', short: 'm' },
  mode: { type: 'string' },
  'thinking-level': { type: 'string' },
  config: { type: 'string' },
  profile: { type: 'string' },
  help: { type: 'boolean', short: 'h', default: false },
} as const;

/** Parse CLI arguments for headless mode (--prompt, --timeout, --format, --continue, --model, --mode, --thinking-level, --config, --profile). */
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

  const config = typeof values.config === 'string' ? values.config : undefined;
  const profile = typeof values.profile === 'string' ? values.profile : undefined;

  return {
    prompt,
    timeout,
    format: format as 'default' | 'json',
    continue_: Boolean(values.continue),
    model,
    mode,
    thinkingLevel,
    config,
    profile,
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
  --timeout <seconds>           Exit with code 2 if not complete within timeout
  --format <type>               Output format: "default" or "json" (default: "default")
  --model, -m <id>              Model override (e.g., "anthropic/claude-sonnet-4-5")
  --mode {build|plan|fast}      Execution mode — defaults to "build" if omitted
  --thinking-level <level>      Thinking level: off, low, medium, high, xhigh
  --config <path>               Path to headless config file (default: .mastracode/headless.json)
  --profile <name>              Use a named profile from the config file

Config file:
  Place a headless.json in .mastracode/ (project) or ~/.mastracode/ (global).
  Project config replaces global config entirely (no merge between them).
  {
    "models": {
      "activeModelPackId": "anthropic",
      "modeDefaults": {},
      "activeOmPackId": "anthropic",
      "omModelOverride": null,
      "subagentModels": {},
      "omObservationThreshold": null,
      "omReflectionThreshold": null
    },
    "preferences": { "thinkingLevel": "medium", "yolo": true },
    "profiles": {
      "ci": {
        "models": { "activeModelPackId": "anthropic" },
        "preferences": { "thinkingLevel": "off" }
      }
    }
  }

  Pack references: use built-in pack IDs (e.g., "anthropic", "openai") to
  resolve models at runtime. Explicit modeDefaults override activeModelPackId.
  Custom pack IDs ("custom:...") are not supported — use modeDefaults instead.

Exit codes:
  0  Agent completed successfully
  1  Error or aborted
  2  Timeout

Examples:
  mastracode --prompt "Fix the bug in auth.ts"
  mastracode --prompt "Add tests" --timeout 300
  mastracode --prompt "Fix the bug" --mode fast --thinking-level high
  mastracode --config ./ci.json --prompt "Run tests"
  mastracode --profile ci --prompt "Run lint checks"
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
export async function runHeadless(
  harness: Harness,
  args: HeadlessArgs & { prompt: string },
  packContext?: PackContext,
): Promise<number> {
  // Harness is imported without its generic state param, so setState doesn't know about
  // thinkingLevel, yolo, observationThreshold, etc. Cast once here instead of at every call site.
  const setHarnessState = (state: Record<string, unknown>) => harness.setState(state as any);

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

  function failEarly(msg: string): 1 {
    if (emit) emit({ type: 'error', error: { message: msg } });
    else process.stderr.write(`Error: ${msg}\n`);
    if (timeoutId) clearTimeout(timeoutId);
    return 1;
  }

  // --- Pre-flight checks (before subscribing to events) ---

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

  // --- Load config file ---
  let config: HeadlessConfig = {};
  try {
    config = loadHeadlessConfig({
      configPath: args.config,
      projectDir: process.cwd(),
    });
  } catch (err) {
    return failEarly((err as Error).message);
  }

  // --- Resolve profile ---
  let resolvedConfig: HeadlessProfileConfig = config;
  if (args.profile) {
    try {
      resolvedConfig = resolveProfile(config, args.profile);
      if (!emit) process.stderr.write(`[profile] ${args.profile}\n`);
    } catch (err) {
      return failEarly((err as Error).message);
    }
  }

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
  } else if (resolvedConfig.models) {
    const modelsConfig = resolvedConfig.models;

    // 1. Resolve effective modeDefaults: explicit modeDefaults > activeModelPackId > none
    let effectiveDefaults: Partial<Record<string, string>> | undefined;

    if (modelsConfig.modeDefaults && Object.keys(modelsConfig.modeDefaults).length > 0) {
      effectiveDefaults = modelsConfig.modeDefaults;
    } else if (modelsConfig.activeModelPackId && packContext) {
      const packId = modelsConfig.activeModelPackId;
      if (packId.startsWith('custom:')) {
        const warnMsg = 'Custom pack references are not supported in headless config. Use modeDefaults instead.';
        if (emit) emit({ type: 'warning', message: warnMsg });
        else process.stderr.write(`Warning: ${warnMsg}\n`);
      } else {
        const pack = packContext.builtinPacks.find(p => p.id === packId);
        if (pack) {
          effectiveDefaults = pack.models;
        } else {
          const warnMsg = `Unknown model pack "${packId}", ignoring`;
          if (emit) emit({ type: 'warning', message: warnMsg });
          else process.stderr.write(`Warning: ${warnMsg}\n`);
        }
      }
    }

    // 2. Apply effective modeDefaults
    if (effectiveDefaults) {
      const available = await harness.listAvailableModels();

      for (const [modeId, modelId] of Object.entries(effectiveDefaults)) {
        const match = available.find(m => m.id === modelId);
        if (!match) {
          return failEarly(`Unknown model "${modelId}" configured for mode "${modeId}"`);
        }
        if (!match.hasApiKey) {
          const keyHint = match.apiKeyEnvVar ? ` Set ${match.apiKeyEnvVar} to use this model.` : '';
          return failEarly(`Model "${modelId}" (mode: ${modeId}) has no API key configured.${keyHint}`);
        }
        await harness.setThreadSetting({ key: `modeModelId_${modeId}`, value: modelId });
      }

      // Switch current mode's model
      const mode = args.mode ?? 'build';
      const currentModelId = effectiveDefaults[mode];
      if (currentModelId) {
        await harness.switchModel({ modelId: currentModelId });
        if (!emit) process.stderr.write(`[model] ${currentModelId} (mode: ${mode})\n`);
      }

      // Wire subagent models (same mapping as applyPack: explore→fast, plan→plan, execute→build)
      const subagentModeMap: Record<string, string> = { explore: 'fast', plan: 'plan', execute: 'build' };
      for (const [agentType, modeId] of Object.entries(subagentModeMap)) {
        const saModelId = effectiveDefaults[modeId];
        if (saModelId) {
          await harness.setSubagentModelId({ modelId: saModelId, agentType });
        }
      }
    }

    // 3. Apply explicit subagentModels overrides (on top of pack-derived)
    if (modelsConfig.subagentModels) {
      for (const [agentType, modelId] of Object.entries(modelsConfig.subagentModels)) {
        await harness.setSubagentModelId({ modelId, agentType });
      }
    }

    // 4. Resolve OM model: omModelOverride > activeOmPackId > none
    let omModelId: string | undefined;
    if (typeof modelsConfig.omModelOverride === 'string') {
      omModelId = modelsConfig.omModelOverride;
    } else if (modelsConfig.activeOmPackId && packContext) {
      const omPackId = modelsConfig.activeOmPackId;
      if (omPackId.startsWith('custom:')) {
        const warnMsg = 'Custom OM pack references are not supported in headless config. Use omModelOverride instead.';
        if (emit) emit({ type: 'warning', message: warnMsg });
        else process.stderr.write(`Warning: ${warnMsg}\n`);
      } else {
        const omPack = packContext.builtinOmPacks.find(p => p.id === omPackId);
        if (omPack) {
          omModelId = omPack.modelId;
        } else {
          const warnMsg = `Unknown OM pack "${omPackId}", ignoring`;
          if (emit) emit({ type: 'warning', message: warnMsg });
          else process.stderr.write(`Warning: ${warnMsg}\n`);
        }
      }
    }

    if (omModelId) {
      await harness.switchObserverModel({ modelId: omModelId });
      await harness.switchReflectorModel({ modelId: omModelId });
      if (!emit) process.stderr.write(`[om-model] ${omModelId}\n`);
    }

    // 5. Apply OM thresholds
    if (typeof modelsConfig.omObservationThreshold === 'number') {
      await setHarnessState({ observationThreshold: modelsConfig.omObservationThreshold });
    }
    if (typeof modelsConfig.omReflectionThreshold === 'number') {
      await setHarnessState({ reflectionThreshold: modelsConfig.omReflectionThreshold });
    }
  }

  // --- Resolve thinking level ---
  const thinkingLevel = args.thinkingLevel ?? resolvedConfig.preferences?.thinkingLevel;
  if (thinkingLevel) {
    await setHarnessState({ thinkingLevel });
    if (!emit) process.stderr.write(`[thinking] ${thinkingLevel}\n`);
  }

  // --- Resolve yolo from config ---
  // Headless mode starts with yolo: true (set at harness init in headlessMain).
  // Config can explicitly override this — e.g., yolo: false for a review profile
  // that should still prompt on destructive operations.
  if (resolvedConfig.preferences?.yolo !== undefined) {
    await setHarnessState({ yolo: resolvedConfig.preferences.yolo });
  }

  // --- Subscribe and send (after all pre-flight checks pass) ---

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
  const { harness, mcpManager, builtinPacks, builtinOmPacks } = result;

  if (mcpManager?.hasServers()) {
    mcpManager.initInBackground().catch(() => {
      // Non-fatal — tools from MCP servers won't be available
    });
  }

  setupDebugLogging();
  await harness.init();

  const packs: PackContext | undefined = builtinPacks && builtinOmPacks ? { builtinPacks, builtinOmPacks } : undefined;
  const exitCode = await runHeadless(harness, { ...args, prompt }, packs);

  // Cleanup
  releaseAllThreadLocks();
  await Promise.allSettled([mcpManager?.disconnect(), harness?.stopHeartbeats()]);

  process.exit(exitCode);
}
