import { z } from 'zod/v4';
import { browserCliHandler } from '../../browser/cli-handler';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { SandboxFeatureNotSupportedError } from '../errors';
import {
  DEFAULT_MAX_RETAINED_PROCESS_OUTPUT_BYTES,
  RetainedOutputBuffer,
} from '../sandbox/process-manager/process-handle';
import type { ProcessHandle } from '../sandbox/process-manager/process-handle';
import type { CommandResult } from '../sandbox/types';
import type { Workspace } from '../workspace';
import { coerceNumericString, emitWorkspaceMetadata, requireSandbox } from './helpers';
import { DEFAULT_TAIL_LINES, noteDroppedOutput, truncateOutput, sandboxToModelOutput } from './output-helpers';
import { startWorkspaceSpan } from './tracing';

/**
 * Base input schema for execute_command (no background param).
 * Extended with `background` in tools.ts when sandbox.processes exists.
 */
export const executeCommandInputSchema = z.object({
  command: z
    .string()
    .describe('The shell command to execute (e.g., "npm install", "ls -la src/", "cat file.txt | grep error")'),
  timeout: z
    .preprocess(coerceNumericString, z.number())
    .nullish()
    .describe('Maximum execution time in seconds. Example: 60 for 1 minute.'),
  cwd: z.string().nullish().describe('Working directory for the command'),
  tail: z
    .preprocess(coerceNumericString, z.number().int())
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
      'Run the command in the background. Returns a PID immediately instead of waiting for completion. You are notified when it exits; use get_process_output to check on it before then.',
    ),
});

// Listed first so models write the summary before the command itself.
const descriptionShape = {
  description: z
    .string()
    .min(1)
    .describe(
      'Short plain-language description of what this command does, shown to the user in place of the raw command (5-10 words, e.g. "Running the auth unit tests"). Write it first, before `command` and the other arguments, so the user sees it while the rest of the call streams in. Write it as the next step in an ongoing narrative: it can build on your previous commands implicitly, e.g. after "Searching open PRs for failing CI" the next command can be "Drilling into the first of 15 failures".',
    ),
};

/** Base schema with a required leading `description` (used when `requireDescription` is set). */
export const executeCommandWithDescriptionSchema = z.object({
  ...descriptionShape,
  ...executeCommandInputSchema.shape,
});

/** Background schema with a required leading `description`. */
export const executeCommandWithDescriptionAndBackgroundSchema = z.object({
  ...descriptionShape,
  ...executeCommandWithBackgroundSchema.shape,
});

/** A command whose final pipeline stage is `tail`, e.g. `make test 2>&1 | tail -20`. */
const TRAILING_TAIL_PIPE = /(?:^|[^|])\|\s*tail(?:\s[^|;&]*)?$/;

/**
 * POSIX shells report a pipeline's status from its last command, so `cmd | tail -N` exits 0 even
 * when `cmd` fails. Enable `pipefail` (where the shell supports it) for pipelines ending in `tail`
 * so the upstream failure is reported. `tail` reads all of its input, so upstream commands are
 * not cut off by SIGPIPE. LocalSandbox on Windows runs commands through cmd.exe, which has no
 * `set -o`.
 */
function reportUpstreamPipelineFailure(command: string, sandboxProvider: string): string {
  if (sandboxProvider === 'local' && process.platform === 'win32') return command;
  if (!TRAILING_TAIL_PIPE.test(command.trim())) return command;
  return `(set -o pipefail) 2>/dev/null && set -o pipefail; ${command}`;
}

const ABORTED_COMMAND_NOTE =
  'Command aborted: the run was cancelled (by the user or system) while this command was running, so it was killed before it finished.';
const CANCELLED_RUN_NOTE = 'The run was cancelled (by the user or system) while this command was running.';

/** Format command streams consistently with get_process_output. */
function formatCommandOutput(stdout: string, stderr: string): string[] {
  const parts: string[] = [];

  if (stdout && stderr) {
    parts.push('stdout:', stdout, '', 'stderr:', stderr);
  } else if (stdout) {
    parts.push(stdout);
  } else if (stderr) {
    parts.push('stderr:', stderr);
  }

  return parts;
}

/** Append a terminal status after one blank line without altering streamed output. */
function appendTerminalLine(parts: string[], terminalLine: string): string {
  if (parts.length === 0) return terminalLine;

  const output = parts.join('\n');
  const separator = output.endsWith('\n\n') ? '' : output.endsWith('\n') ? '\n' : '\n\n';
  return `${output}${separator}${terminalLine}`;
}

export const DEFAULT_FOREGROUND_DETACH_MS = 5 * 60_000;

/** Processes whose exit will be reported to the agent that started them. */
const exitNotified = new WeakSet<ProcessHandle>();

/** Whether the agent that started this process will be notified when it exits. */
export function willNotifyOnExit(handle: ProcessHandle): boolean {
  return exitNotified.has(handle);
}
/** Output lines included in a process-exit notification. */
const EXIT_NOTIFICATION_TAIL_LINES = 20;

/**
 * Watch a process the agent is no longer waiting on: run the configured `onExit`
 * callback and, unless disabled, notify the agent that spawned it, which wakes an
 * idle thread. Runs after the tool has returned, so every failure is logged rather
 * than thrown.
 */
function observeExit(
  handle: ProcessHandle,
  { command, context, workspace }: { command: string; context: any; workspace: Workspace },
) {
  const toolCallId = context?.agent?.toolCallId;
  const bgConfig = workspace.getToolsConfig()?.[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]?.backgroundProcesses;
  const target = exitNotificationTarget(context, bgConfig?.notifyOnExit);
  if (!bgConfig?.onExit && !target) return;
  if (target) exitNotified.add(handle);

  void handle
    .wait()
    .then(async result => {
      if (bgConfig?.onExit) {
        try {
          await bgConfig.onExit({
            pid: handle.pid,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            stdoutTruncated: result.stdoutTruncated,
            stderrTruncated: result.stderrTruncated,
            stdoutDroppedBytes: result.stdoutDroppedBytes,
            stderrDroppedBytes: result.stderrDroppedBytes,
            toolCallId,
          });
        } catch (callbackError) {
          workspace.logger?.error('Background process onExit callback threw', {
            error: callbackError,
            pid: handle.pid,
            toolCallId,
          });
        }
      }
      // A killed process was stopped by the agent (kill_process) or by a cancelled run:
      // nothing new to tell it.
      if (!target || (result.killed && !result.timedOut)) return;
      try {
        await notifyAgentOfExit(target, handle.pid, command, result);
      } catch (notifyError) {
        workspace.logger?.warn('Could not notify the agent that a background process exited', {
          error: notifyError,
          pid: handle.pid,
          toolCallId,
        });
      }
    })
    .catch(observeError => {
      // Observation failures never synthesize a successful exit.
      workspace.logger?.error('Failed to observe background process exit', {
        error: observeError,
        pid: handle.pid,
        toolCallId,
      });
    });
}

/**
 * Run a foreground command, but stop waiting on it after `detachMs`: the agent gets
 * the handle back and the command keeps running. The run's abort signal stops the
 * command only while the agent is still waiting on it.
 */
async function runUntilDetached(
  processes: NonNullable<Workspace['sandbox']>['processes'] & {},
  command: string,
  options: {
    cwd?: string;
    timeout?: number;
    abortSignal?: AbortSignal;
    detachMs: number;
    onStdout: (data: string) => Promise<void>;
    onStderr: (data: string) => Promise<void>;
  },
): Promise<{ result: CommandResult } | { detached: ProcessHandle }> {
  let waiting = true;
  const stop = new AbortController();
  const forwardAbort = () => stop.abort(options.abortSignal?.reason);
  if (options.abortSignal?.aborted) forwardAbort();
  else options.abortSignal?.addEventListener('abort', forwardAbort, { once: true });

  let timer: Parameters<typeof clearTimeout>[0];
  try {
    const handle = await processes.spawn(command, {
      cwd: options.cwd,
      timeout: options.timeout,
      // The agent can't drive stdin, so a command reading it would never exit.
      stdinMode: 'ignore',
    });
    const exited = handle.wait({
      abortSignal: stop.signal,
      // Once detached, the output is read through get_process_output instead.
      onStdout: data => void (waiting && options.onStdout(data).catch(() => {})),
      onStderr: data => void (waiting && options.onStderr(data).catch(() => {})),
    });
    const detached = new Promise<undefined>(resolve => {
      timer = setTimeout(resolve, options.detachMs);
    });
    const result = await Promise.race([exited, detached]);
    if (result) return { result };
    // Keep a later rejection from surfacing as unhandled; observeExit reports it.
    exited.catch(() => {});
    return { detached: handle };
  } finally {
    waiting = false;
    clearTimeout(timer);
    options.abortSignal?.removeEventListener('abort', forwardAbort);
  }
}

type ExitNotificationTarget = {
  mastra: { getAgentById: (id: string) => any };
  agentId: string;
  resourceId: string;
  threadId: string;
  toolCallId?: string;
};

/** The agent thread that spawned the process, captured now because the exit outlives this call. */
function exitNotificationTarget(context: any, enabled: boolean | undefined): ExitNotificationTarget | undefined {
  if (enabled === false) return undefined;
  const { agentId, resourceId, threadId, toolCallId } = context?.agent ?? {};
  const mastra = context?.mastra;
  if (!agentId || !resourceId || !threadId || typeof mastra?.getAgentById !== 'function') return undefined;
  return { mastra, agentId, resourceId, threadId, toolCallId };
}

async function notifyAgentOfExit(target: ExitNotificationTarget, pid: string, command: string, result: CommandResult) {
  const agent = target.mastra.getAgentById(target.agentId);
  const output = formatCommandOutput(
    await truncateOutput(result.stdout, EXIT_NOTIFICATION_TAIL_LINES),
    await truncateOutput(result.stderr, EXIT_NOTIFICATION_TAIL_LINES),
  ).join('\n');
  const status = result.timedOut ? 'timed out' : `exited with code ${result.exitCode}`;
  const summary = [`Background process ${pid} (\`${command}\`) ${status}.`, output && `Last output:\n${output}`]
    .filter(Boolean)
    .join('\n\n');

  const sent = await agent.sendNotificationSignal(
    {
      source: 'workspace',
      kind: 'process-exit',
      priority: 'high',
      summary,
      sourceId: pid,
      dedupeKey: `process-exit:${target.toolCallId ?? ''}:${pid}`,
      payload: { pid, command, exitCode: result.exitCode, success: result.success, timedOut: result.timedOut },
    },
    { resourceId: target.resourceId, threadId: target.threadId },
  );
  await Promise.all([sent.persisted, sent.accepted].filter(Boolean));
}

/** Shared execute function used by both foreground-only and background-capable tool variants. */
async function executeCommand(input: Record<string, any>, context: any) {
  let { command } = input;
  const { cwd, tail } = input;
  const timeout = input.timeout != null ? (input.timeout as number) * 1000 : undefined;
  const background = input.background as boolean | undefined;
  const { workspace, sandbox } = requireSandbox(context);

  // Lazy browser launch and CDP URL injection for browser CLI commands
  const browser = workspace.browser;
  const { browserClis, usingExternalCdp, externalCdpUrl } = browserCliHandler.analyzeCommand(command);

  if (browser && browserClis.length > 0 && !usingExternalCdp) {
    const threadId = context?.agent?.threadId ?? context?.threadId ?? 'default';

    // Launch browser if not already running (for this thread if thread-scoped)
    if (!browser.isBrowserRunning(threadId)) {
      await browser.launch(threadId);
    }

    const cdpUrl = browser.getCdpUrl(threadId);
    const browserId = browser.id;

    if (cdpUrl) {
      // Run warmup commands for CLIs that need them
      const warmups = browserCliHandler.getWarmupCommands(browserId, browserClis, cdpUrl, threadId);
      for (const { cliName, command: warmupCmd } of warmups) {
        try {
          if (sandbox.executeCommand) {
            await sandbox.executeCommand(warmupCmd, [], { timeout: 10000 });
          }
          // Only mark as warmed up after successful warmup
          browserCliHandler.markWarmedUp(browserId, cliName, threadId);
          // Register cleanup when browser closes
          browserCliHandler.registerWarmupCleanup(browserId, cliName, threadId, browser);
        } catch {
          // Don't mark as warmed up - will retry on next command
          // This allows recovery if the CLI daemon wasn't ready
        }
      }

      // Inject CDP URL into all browser CLI commands in the chain
      command = browserCliHandler.injectCdpUrl(command, cdpUrl, threadId);
    }
  } else if (browser && browserClis.length > 0 && usingExternalCdp && externalCdpUrl) {
    // Agent is using their own external CDP - connect BrowserViewer to it for screencast
    const threadId = context?.agent?.threadId ?? context?.threadId ?? 'default';
    try {
      await browser.connectToExternalCdp(externalCdpUrl, threadId);
    } catch {
      // Non-fatal - agent can still use the external CDP, just no screencast
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
      // A background process collects output rather than being driven over stdin,
      // so close stdin at spawn. Otherwise `rg`/`grep`/`cat` with no path argument
      // reads stdin and never exits.
      stdinMode: 'ignore',
      onStdout: bgConfig?.onStdout
        ? (data: string) => bgConfig.onStdout!(data, { pid: handle.pid, toolCallId })
        : undefined,
      onStderr: bgConfig?.onStderr
        ? (data: string) => bgConfig.onStderr!(data, { pid: handle.pid, toolCallId })
        : undefined,
    });

    observeExit(handle, { command, context, workspace });

    span.end({ success: true }, { pid: Number(handle.pid) || undefined });
    const notified = exitNotificationTarget(context, bgConfig?.notifyOnExit)
      ? ". You'll be notified when it exits"
      : '';
    return `Started background process (PID: ${handle.pid})${notified}`;
  }

  // Foreground mode: execute and wait for completion
  if (!sandbox.executeCommand) {
    const err = new SandboxFeatureNotSupportedError('executeCommand');
    span.error(err);
    throw err;
  }

  const startedAt = Date.now();
  // Bounded copies used only on the error path, where the sandbox result is unavailable.
  // Unbounded accumulation here crashes the process with RangeError on very large output.
  const stdout = new RetainedOutputBuffer(DEFAULT_MAX_RETAINED_PROCESS_OUTPUT_BYTES);
  const stderr = new RetainedOutputBuffer(DEFAULT_MAX_RETAINED_PROCESS_OUTPUT_BYTES);
  // Snapshot the abort state when the command settles: an abort that lands afterwards
  // (while the result is being reported) did not stop the command.
  let abortedWhenSettled = false;
  try {
    const onStdout = async (data: string) => {
      stdout.append(data);
      await context?.writer?.custom({
        type: 'data-sandbox-stdout',
        data: { output: data, timestamp: Date.now(), toolCallId },
        transient: true,
      });
    };
    const onStderr = async (data: string) => {
      stderr.append(data);
      await context?.writer?.custom({
        type: 'data-sandbox-stderr',
        data: { output: data, timestamp: Date.now(), toolCallId },
        transient: true,
      });
    };
    const shellCommand = reportUpstreamPipelineFailure(command, sandbox.provider);
    const detachMs = toolConfig?.foregroundDetachMs ?? DEFAULT_FOREGROUND_DETACH_MS;

    let result: CommandResult;
    if (sandbox.processes && detachMs !== false) {
      const outcome = await runUntilDetached(sandbox.processes, shellCommand, {
        cwd: cwd ?? undefined,
        timeout: timeout ?? undefined,
        abortSignal: context?.abortSignal,
        detachMs,
        onStdout,
        onStderr,
      }).finally(() => {
        abortedWhenSettled = context?.abortSignal?.aborted === true;
      });

      if ('detached' in outcome) {
        const handle = outcome.detached;
        observeExit(handle, { command, context, workspace });
        span.end({ success: true }, { pid: Number(handle.pid) || undefined });
        const parts = formatCommandOutput(
          noteDroppedOutput(await truncateOutput(handle.stdout, tail, tokenLimit, tokenFrom), stdout.dropped, 'stdout'),
          noteDroppedOutput(await truncateOutput(handle.stderr, tail, tokenLimit, tokenFrom), stderr.dropped, 'stderr'),
        );
        const minutes = Math.round((detachMs / 60_000) * 10) / 10;
        const notified = exitNotificationTarget(context, toolConfig?.backgroundProcesses?.notifyOnExit)
          ? " You'll be notified when it exits."
          : '';
        return appendTerminalLine(
          parts,
          `Still running after ${minutes} minute${minutes === 1 ? '' : 's'}, so it was moved to the background (PID: ${handle.pid}).${notified} Use get_process_output to check on it or kill_process to stop it.`,
        );
      }
      result = outcome.result;
    } else {
      result = await sandbox
        .executeCommand(shellCommand, [], {
          timeout: timeout ?? undefined,
          cwd: cwd ?? undefined,
          abortSignal: context?.abortSignal, // foreground processes use agent's abort signal
          onStdout,
          onStderr,
        })
        .finally(() => {
          abortedWhenSettled = context?.abortSignal?.aborted === true;
        });
    }

    await context?.writer?.custom({
      type: 'data-sandbox-exit',
      data: {
        exitCode: result.exitCode,
        success: result.success,
        executionTimeMs: result.executionTimeMs,
        killed: result.killed,
        timedOut: result.timedOut,
        toolCallId,
      },
    });

    span.end({ success: result.success }, { exitCode: result.exitCode });

    const stdoutForModel = noteDroppedOutput(
      await truncateOutput(result.stdout, tail, tokenLimit, tokenFrom),
      result.stdoutDroppedBytes,
      'stdout',
    );
    const stderrForModel = noteDroppedOutput(
      await truncateOutput(result.stderr, tail, tokenLimit, tokenFrom),
      result.stderrDroppedBytes,
      'stderr',
    );

    if (!result.success) {
      const parts = formatCommandOutput(stdoutForModel, stderrForModel);
      // The exit code of an aborted command is a provider-specific kill code (LocalSandbox
      // reports 128, which also means "fatal" for git), so the abort signal is the only
      // reliable way to tell the model why it stopped. `killed: false` means the command
      // exited on its own just before the abort. Only claim a kill when the provider confirms
      // it; missing kill metadata is not confirmation that remote work stopped.
      const aborted = abortedWhenSettled && result.killed !== false && !result.timedOut;
      const abortNote = result.killed === true ? ABORTED_COMMAND_NOTE : CANCELLED_RUN_NOTE;
      const exitLine = `Exit code: ${result.exitCode}`;
      return appendTerminalLine(parts, aborted ? `${abortNote}\n${exitLine}` : exitLine);
    }

    return formatCommandOutput(stdoutForModel, stderrForModel).join('\n') || '(no output)';
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await context?.writer?.custom({
      type: 'data-sandbox-exit',
      data: {
        exitCode: -1,
        success: false,
        executionTimeMs: Date.now() - startedAt,
        // -1 is no exit code: the command could not run or be observed, and this says why.
        error: errorMessage,
        toolCallId,
      },
    });
    span.end({ success: false }, { exitCode: -1 });
    const parts = formatCommandOutput(
      noteDroppedOutput(await truncateOutput(stdout.toString(), tail, tokenLimit, tokenFrom), stdout.dropped, 'stdout'),
      noteDroppedOutput(await truncateOutput(stderr.toString(), tail, tokenLimit, tokenFrom), stderr.dropped, 'stderr'),
    );
    const errorLine = `Error: ${errorMessage}\nExit code: -1`;
    return appendTerminalLine(parts, abortedWhenSettled ? `${CANCELLED_RUN_NOTE}\n${errorLine}` : errorLine);
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
- Optionally use cwd to override the working directory. Commands run from the sandbox's configured workingDirectory (or the provider default) if omitted.`;

/** Foreground-only tool (no background param in schema). */
export const executeCommandTool = createTool({
  id: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
  description: baseDescription,
  inputSchema: executeCommandInputSchema,
  outputSchema: z.string(),
  execute: executeCommand,
  toModelOutput: sandboxToModelOutput,
});

const backgroundDescription = `${baseDescription}

Set background: true to run long-running commands (dev servers, watchers) without blocking. You'll get a PID to track the process, and a notification with its exit code and last output when it exits, so there's no need to poll it.

A foreground command still running after 5 minutes moves to the background: you get its output so far and its PID, and a notification when it exits.`;

/** Tool with background param in schema (used when sandbox.processes exists). */
export const executeCommandWithBackgroundTool = createTool({
  id: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
  description: backgroundDescription,
  inputSchema: executeCommandWithBackgroundSchema,
  outputSchema: z.string(),
  execute: executeCommand,
  toModelOutput: sandboxToModelOutput,
});

/** Foreground-only tool that requires a leading `description` arg. */
export const executeCommandWithDescriptionTool = createTool({
  id: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
  description: baseDescription,
  inputSchema: executeCommandWithDescriptionSchema,
  outputSchema: z.string(),
  execute: executeCommand,
  toModelOutput: sandboxToModelOutput,
});

/** Background-capable tool that requires a leading `description` arg. */
export const executeCommandWithDescriptionAndBackgroundTool = createTool({
  id: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
  description: backgroundDescription,
  inputSchema: executeCommandWithDescriptionAndBackgroundSchema,
  outputSchema: z.string(),
  execute: executeCommand,
  toModelOutput: sandboxToModelOutput,
});
