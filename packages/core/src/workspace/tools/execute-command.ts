import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { SandboxFeatureNotSupportedError } from '../errors';
import { emitWorkspaceMetadata, requireSandbox } from './helpers';
import { DEFAULT_TAIL_LINES, truncateOutput, sandboxToModelOutput } from './output-helpers';
import { startWorkspaceSpan } from './tracing';

/**
 * Base input schema for execute_command (no background param).
 * Extended with `background` in tools.ts when sandbox.processes exists.
 */
export const executeCommandInputSchema = z.object({
  command: z
    .string()
    .describe('The shell command to execute (e.g., "npm install", "ls -la src/", "cat file.txt | grep error")'),
  timeout: z.number().nullish().describe('Maximum execution time in seconds. Example: 60 for 1 minute.'),
  cwd: z.string().nullish().describe('Working directory for the command'),
  tail: z
    .number()
    .nullish()
    .describe(
      `For foreground commands: limit output to the last N lines, similar to tail -n. Defaults to ${DEFAULT_TAIL_LINES}. Use 0 for no limit.`,
    ),
});

/** Schema with background param included. */
export const executeCommandWithBackgroundSchema = executeCommandInputSchema.extend({
  background: z
    .boolean()
    .optional()
    .describe(
      'Run the command in the background. Returns a PID immediately instead of waiting for completion. Use get_process_output to check on it later.',
    ),
});

/**
 * Extract `| tail -N` or `| tail -n N` from the end of a command.
 * LLMs are trained to pipe to tail for long outputs, but this prevents streaming —
 * the user sees nothing until the command finishes. By stripping the tail pipe and
 * applying it programmatically afterward, all output streams in real time while
 * the final result sent to the model is still truncated.
 *
 * Returns the cleaned command and extracted tail line count (if any).
 */
function extractTailPipe(command: string): { command: string; tail?: number } {
  const match = command.match(/\|\s*tail\s+(?:-n\s+)?(-?\d+)\s*$/);
  if (match) {
    const lines = Math.abs(parseInt(match[1]!, 10));
    if (lines > 0) {
      return {
        command: command.replace(/\|\s*tail\s+(?:-n\s+)?-?\d+\s*$/, '').trim(),
        tail: lines,
      };
    }
  }
  return { command };
}

/**
 * CLI provider patterns for CDP URL injection.
 * Maps CLI command prefixes to their CDP URL flag.
 * All CLIs accept either port number or full WebSocket URL.
 * We use full URL for consistency.
 *
 * warmupCommand: Some CLIs (like agent-browser) need a "connect" command
 * to be run first to establish their daemon's CDP connection before other
 * commands will work properly.
 */
const CLI_CDP_PATTERNS: Record<
  string,
  {
    pattern: RegExp;
    flag: string;
    sessionFlag?: string; // Flag to pass threadId as session name for isolation
    warmupCommand?: (cdpUrl: string, threadId: string) => string;
  }
> = {
  'agent-browser': {
    pattern: /^agent-browser\b/,
    flag: '--cdp',
    sessionFlag: '--session',
    // agent-browser daemon needs explicit connect command to establish CDP connection
    // Must include session flag to isolate threads
    warmupCommand: (cdpUrl: string, threadId: string) => `agent-browser --session "${threadId}" connect "${cdpUrl}"`,
  },
  'browser-use': {
    // browser-use CLI installs as multiple aliases: browser, browseruse, bu
    // The skill docs say "browser-use" but the primary binary is "browser"
    // Order matters: longer matches first to avoid "browser" matching before "browser-use"
    pattern: /^(?:browser-use|browseruse|browser|bu)\b/,
    flag: '--cdp-url',
    sessionFlag: '--session',
  },
  browse: { pattern: /^browse\b/, flag: '--ws' },
};

/**
 * Track which CLI providers have been warmed up per thread.
 * Key format: `${cliName}:${threadId}`
 */
const warmedUpClis = new Set<string>();

/**
 * Check if a command is a browser CLI command and return its config.
 */
function getBrowserCliConfig(command: string): { name: string; config: (typeof CLI_CDP_PATTERNS)[string] } | null {
  for (const [name, config] of Object.entries(CLI_CDP_PATTERNS)) {
    if (config.pattern.test(command)) {
      return { name, config };
    }
  }
  return null;
}

/**
 * Inject CDP URL and session flag into a single browser CLI command.
 * Returns the modified command or the original if no injection needed.
 */
function injectCdpUrlIntoSingleCommand(
  command: string,
  cdpUrl: string,
  config: (typeof CLI_CDP_PATTERNS)[string],
  threadId?: string,
): string {
  // Check if CDP flag is already present
  const flagPattern = new RegExp(`${config.flag}\\s+\\S+`);
  if (flagPattern.test(command)) {
    return command; // Already has CDP URL, don't override
  }

  // Build injection: CDP URL + session flag (for thread isolation)
  let injection = `${config.flag} "${cdpUrl}"`;
  if (config.sessionFlag && threadId) {
    // Check if session flag already present
    const sessionPattern = new RegExp(`${config.sessionFlag}\\s+\\S+`);
    if (!sessionPattern.test(command)) {
      injection += ` ${config.sessionFlag} "${threadId}"`;
    }
  }

  // Inject flags after the CLI command name
  return command.replace(config.pattern, `$& ${injection}`);
}

/**
 * Split a command string on shell operators (&&, ||, ;) while preserving
 * the operators for reassembly. Returns alternating [command, operator, command, ...].
 */
function splitShellCommand(command: string): { parts: string[]; operators: string[] } {
  const parts: string[] = [];
  const operators: string[] = [];

  // Match && or || or ; as separators
  const regex = /\s*(&&|\|\||;)\s*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(command)) !== null) {
    parts.push(command.slice(lastIndex, match.index));
    operators.push(match[1]!);
    lastIndex = regex.lastIndex;
  }

  // Add the remaining part after the last operator
  parts.push(command.slice(lastIndex));

  return { parts, operators };
}

/**
 * Inject CDP URL and session flag into all browser CLI commands in a potentially
 * chained command string (commands joined by &&, ||, or ;).
 */
function injectCdpUrl(command: string, cdpUrl: string, threadId?: string): string {
  const { parts, operators } = splitShellCommand(command);

  const modifiedParts = parts.map(part => {
    const trimmed = part.trim();
    const cliMatch = getBrowserCliConfig(trimmed);
    if (cliMatch) {
      return injectCdpUrlIntoSingleCommand(trimmed, cdpUrl, cliMatch.config, threadId);
    }
    return part; // Keep original (preserves whitespace)
  });

  // Reassemble with operators
  let result = modifiedParts[0] ?? '';
  for (let i = 0; i < operators.length; i++) {
    result += ` ${operators[i]} ${modifiedParts[i + 1] ?? ''}`;
  }

  return result;
}

/** Shared execute function used by both foreground-only and background-capable tool variants. */
async function executeCommand(input: Record<string, any>, context: any) {
  let { command, cwd, tail } = input;
  const timeout = input.timeout != null ? (input.timeout as number) * 1000 : undefined;
  const background = input.background as boolean | undefined;
  const { workspace, sandbox } = requireSandbox(context);

  // Extract tail pipe from command so output can stream in real time
  if (!background) {
    const extracted = extractTailPipe(command);
    command = extracted.command;
    // Extracted tail overrides schema tail param (explicit pipe intent takes priority)
    if (extracted.tail != null) {
      tail = extracted.tail;
    }
  }

  // Lazy browser launch and CDP URL injection for browser CLI commands
  // Check all parts of chained commands (e.g., "cmd1 && cmd2") for browser CLIs
  const browser = workspace.browser;
  const { parts } = splitShellCommand(command);
  const browserClis = parts
    .map(part => getBrowserCliConfig(part.trim()))
    .filter((match): match is NonNullable<typeof match> => match !== null);

  if (browser && browserClis.length > 0) {
    const threadId = context?.agent?.threadId ?? context?.threadId ?? 'default';

    // Launch browser if not already running (for this thread if thread-scoped)
    if (!browser.isBrowserRunning(threadId)) {
      await browser.launch(threadId);
    }

    const cdpUrl = browser.getCdpUrl(threadId);

    if (cdpUrl) {
      // Run warmup commands for CLIs that need them
      for (const { name: cliName, config: cliConfig } of browserClis) {
        const warmupKey = `${cliName}:${threadId}`;
        if (cliConfig.warmupCommand && !warmedUpClis.has(warmupKey)) {
          const warmupCmd = cliConfig.warmupCommand(cdpUrl, threadId);
          try {
            if (sandbox.executeCommand) {
              await sandbox.executeCommand(warmupCmd, [], { timeout: 10000 });
            }
            warmedUpClis.add(warmupKey);
          } catch {
            // Still mark as warmed up to avoid retrying every command
            warmedUpClis.add(warmupKey);
          }
        }
      }

      // Inject CDP URL into all browser CLI commands in the chain
      command = injectCdpUrl(command, cdpUrl, threadId);
    }
  }

  await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
  const toolCallId = context?.agent?.toolCallId;
  const toolConfig = workspace.getToolsConfig()?.[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND];
  const tokenLimit = toolConfig?.maxOutputTokens;
  const tokenFrom = 'sandwich' as const;

  const span = startWorkspaceSpan(context, workspace, {
    category: 'sandbox',
    operation: background ? 'spawnProcess' : 'executeCommand',
    input: { command, cwd, timeout: input.timeout, background },
    attributes: { sandboxProvider: sandbox.provider },
  });

  // Background mode: spawn via process manager and return immediately
  if (background) {
    if (!sandbox.processes) {
      const err = new SandboxFeatureNotSupportedError('processes');
      span.error(err);
      throw err;
    }

    const bgConfig = toolConfig?.backgroundProcesses;

    // Resolve abort signal: undefined = use context signal (from agent), null/false = disabled
    const bgAbortSignal =
      bgConfig?.abortSignal === undefined ? context?.abortSignal : bgConfig.abortSignal || undefined;

    // Use `let` so callbacks can reference handle.pid via closure.
    // spawn() resolves before any data events fire (Node event loop guarantees this).
    let handle: Awaited<ReturnType<typeof sandbox.processes.spawn>>;
    handle = await sandbox.processes.spawn(command, {
      cwd: cwd ?? undefined,
      timeout: timeout ?? undefined,
      abortSignal: bgAbortSignal,
      onStdout: bgConfig?.onStdout
        ? (data: string) => bgConfig.onStdout!(data, { pid: handle.pid, toolCallId })
        : undefined,
      onStderr: bgConfig?.onStderr
        ? (data: string) => bgConfig.onStderr!(data, { pid: handle.pid, toolCallId })
        : undefined,
    });

    // Wire exit callback (fire-and-forget)
    if (bgConfig?.onExit) {
      void handle.wait().then(result => {
        bgConfig.onExit!({
          pid: handle.pid,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          toolCallId,
        });
      });
    }

    span.end({ success: true }, { pid: Number(handle.pid) || undefined });
    return `Started background process (PID: ${handle.pid})`;
  }

  // Foreground mode: execute and wait for completion
  if (!sandbox.executeCommand) {
    const err = new SandboxFeatureNotSupportedError('executeCommand');
    span.error(err);
    throw err;
  }

  const startedAt = Date.now();
  let stdout = '';
  let stderr = '';
  try {
    const result = await sandbox.executeCommand(command, [], {
      timeout: timeout ?? undefined,
      cwd: cwd ?? undefined,
      abortSignal: context?.abortSignal, // foreground processes use agent's abort signal
      onStdout: async (data: string) => {
        stdout += data;
        await context?.writer?.custom({
          type: 'data-sandbox-stdout',
          data: { output: data, timestamp: Date.now(), toolCallId },
          transient: true,
        });
      },
      onStderr: async (data: string) => {
        stderr += data;
        await context?.writer?.custom({
          type: 'data-sandbox-stderr',
          data: { output: data, timestamp: Date.now(), toolCallId },
          transient: true,
        });
      },
    });

    await context?.writer?.custom({
      type: 'data-sandbox-exit',
      data: {
        exitCode: result.exitCode,
        success: result.success,
        executionTimeMs: result.executionTimeMs,
        toolCallId,
      },
    });

    span.end({ success: result.success }, { exitCode: result.exitCode });

    if (!result.success) {
      const parts = [
        await truncateOutput(result.stdout, tail, tokenLimit, tokenFrom),
        await truncateOutput(result.stderr, tail, tokenLimit, tokenFrom),
      ].filter(Boolean);
      parts.push(`Exit code: ${result.exitCode}`);
      return parts.join('\n');
    }

    return (await truncateOutput(result.stdout, tail, tokenLimit, tokenFrom)) || '(no output)';
  } catch (error) {
    await context?.writer?.custom({
      type: 'data-sandbox-exit',
      data: {
        exitCode: -1,
        success: false,
        executionTimeMs: Date.now() - startedAt,
        toolCallId,
      },
    });
    span.end({ success: false }, { exitCode: -1 });
    const parts = [
      await truncateOutput(stdout, tail, tokenLimit, tokenFrom),
      await truncateOutput(stderr, tail, tokenLimit, tokenFrom),
    ].filter(Boolean);
    const errorMessage = error instanceof Error ? error.message : String(error);
    parts.push(`Error: ${errorMessage}`);
    return parts.join('\n');
  }
}

const baseDescription = `Execute a shell command in the workspace sandbox.

Examples:
  "npm install && npm run build"
  "ls -la src/"
  "cat config.json | jq '.database'"
  "cd /app && python main.py"

Usage:
- Commands run in a shell, so pipes, redirects, and chaining (&&, ||, ;) all work.
- Always quote file paths that contain spaces (e.g., cd "/path/with spaces").
- Use the timeout parameter (in seconds) to limit execution time. Behavior when omitted depends on the sandbox provider.
- Optionally use cwd to override the working directory. Commands run from the sandbox default if omitted.`;

/** Foreground-only tool (no background param in schema). */
export const executeCommandTool = createTool({
  id: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
  description: baseDescription,
  inputSchema: executeCommandInputSchema,
  execute: executeCommand,
  toModelOutput: sandboxToModelOutput,
});

/** Tool with background param in schema (used when sandbox.processes exists). */
export const executeCommandWithBackgroundTool = createTool({
  id: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
  description: `${baseDescription}

Set background: true to run long-running commands (dev servers, watchers) without blocking. You'll get a PID to track the process.`,
  inputSchema: executeCommandWithBackgroundSchema,
  execute: executeCommand,
  toModelOutput: sandboxToModelOutput,
});
