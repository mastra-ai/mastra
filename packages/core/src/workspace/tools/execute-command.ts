import { z } from 'zod/v4';
import { browserCliHandler } from '../../browser/cli-handler';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { SandboxFeatureNotSupportedError } from '../errors';
import {
  DEFAULT_MAX_RETAINED_PROCESS_OUTPUT_BYTES,
  RetainedOutputBuffer,
} from '../sandbox/process-manager/process-handle';
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
      'Run the command in the background. Returns a PID immediately instead of waiting for completion. Use get_process_output to check on it later.',
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

/** The rewrite below claims file descriptors 8 and 9; commands that use them keep the plain guard. */
const USES_WRAPPER_FDS = /(?:^|[^\w])[89][<>]|[<>]&\s*[89](?!\d)/;

/** Text spans of the final top-level pipeline's stages; the last stage is `tail`. */
type PipelineStages = { start: number; end: number }[];

/** Reserved words that open a compound command, mapped to the word that closes it. */
const COMPOUND_CLOSERS = new Map([
  ['if', 'fi'],
  ['while', 'done'],
  ['until', 'done'],
  ['{', '}'],
]);

/** Reserved words after which the next word starts a command again. */
const COMMAND_CONTINUERS = new Set(['then', 'elif', 'else', 'do']);

/**
 * Find the stages of the final top-level pipeline of `command`, scanning it with POSIX `sh` rules.
 * Returns `undefined` when that pipeline is not a plain `... | tail ...` or when the command uses
 * syntax the scanner does not follow (here-documents, `case`, a trailing comment, unbalanced
 * quotes). Those commands keep the plain `set -o pipefail` guard.
 */
function findTailPipelineStages(command: string): PipelineStages | undefined {
  const scan = scanCommandList(command, 0, false);
  if (!scan || scan.end !== command.length) return undefined;
  const { stageStarts, negated, commentInPipeline } = scan;
  if (stageStarts.length < 2 || negated || commentInPipeline) return undefined;
  const lastStage = command.slice(stageStarts[stageStarts.length - 1]!);
  if (!/^\s*tail(?:\s|$)/.test(lastStage)) return undefined;
  return stageStarts.map((start, index) => ({
    start,
    end: index + 1 < stageStarts.length ? stageStarts[index + 1]! - 1 : command.length,
  }));
}

interface CommandListScan {
  end: number;
  /** Start offsets of the stages of the last pipeline at the outer level. */
  stageStarts: number[];
  negated: boolean;
  commentInPipeline: boolean;
}

/**
 * Scan a command list from `from`. With `nested`, stop at the `)` closing a `$(...)` and return
 * its offset. Returns `undefined` for syntax the scanner does not follow.
 */
function scanCommandList(src: string, from: number, nested: boolean): CommandListScan | undefined {
  const closers: string[] = [];
  let i = from;
  let commandPosition = true;
  let stageStarts = [from];
  let negated = false;
  let commentInPipeline = false;
  let forState: 'none' | 'name' | 'afterName' = 'none';

  const endPipeline = (next: number) => {
    commandPosition = true;
    if (closers.length > 0) return;
    stageStarts = [next];
    negated = false;
    commentInPipeline = false;
  };

  while (i < src.length) {
    const c = src[i]!;
    if (c === ' ' || c === '\t') {
      i++;
    } else if (c === '\\' && src[i + 1] === '\n') {
      i += 2;
    } else if (c === '#') {
      if (closers.length === 0) commentInPipeline = true;
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '\n') {
      // A newline right after `|`, `&&`, `||`, `;` or a reserved word only continues the line.
      if (!commandPosition) endPipeline(i + 1);
      i++;
    } else if (c === ';') {
      if (src[i + 1] === ';') return undefined;
      endPipeline(i + 1);
      i++;
    } else if (c === '&') {
      // bash reads `&>` as a redirection, POSIX sh as `&` then `>`.
      if (src[i + 1] === '>') return undefined;
      i += src[i + 1] === '&' ? 2 : 1;
      endPipeline(i);
    } else if (c === '|') {
      if (src[i + 1] === '|') {
        i += 2;
        endPipeline(i);
      } else if (src[i + 1] === '&') {
        return undefined;
      } else {
        i++;
        commandPosition = true;
        if (closers.length === 0) stageStarts.push(i);
      }
    } else if (c === '(') {
      if (!commandPosition) {
        // `name()` of a function definition; its body follows.
        i++;
        while (src[i] === ' ' || src[i] === '\t') i++;
        if (src[i] !== ')') return undefined;
      } else {
        closers.push(')');
      }
      i++;
      commandPosition = true;
    } else if (c === ')') {
      if (closers.length === 0) {
        if (!nested) return undefined;
        return { end: i, stageStarts, negated, commentInPipeline };
      }
      if (closers.pop() !== ')') return undefined;
      i++;
      commandPosition = false;
    } else if (c === '<' || c === '>') {
      if (src.startsWith('<<', i)) return undefined;
      i += /^(?:>>|>&|>\||<&|<>)/.test(src.slice(i, i + 2)) ? 2 : 1;
      while (src[i] === ' ' || src[i] === '\t') i++;
      const targetEnd = scanWord(src, i);
      if (targetEnd === undefined || targetEnd === i) return undefined;
      i = targetEnd;
      commandPosition = false;
    } else {
      const wordEnd = scanWord(src, i);
      if (wordEnd === undefined) return undefined;
      const word = src.slice(i, wordEnd);
      i = wordEnd;
      if (forState === 'name') {
        forState = 'afterName';
        continue;
      }
      const afterForName = forState === 'afterName';
      forState = 'none';
      if (afterForName && word === 'do') {
        commandPosition = true;
        continue;
      }
      if (word === ']]' && closers[closers.length - 1] === ']]') {
        closers.pop();
        commandPosition = false;
        continue;
      }
      if (!commandPosition) continue;
      if (word === 'case') return undefined;
      if (word === '[[') {
        // bash's conditional command can hold `&&`, `||` and `<`; keep it together.
        closers.push(']]');
        commandPosition = false;
      } else if (word === 'for') {
        closers.push('done');
        forState = 'name';
        commandPosition = false;
      } else if (COMPOUND_CLOSERS.has(word)) {
        closers.push(COMPOUND_CLOSERS.get(word)!);
      } else if (COMMAND_CONTINUERS.has(word)) {
        if (closers.length === 0) return undefined;
      } else if (word === 'fi' || word === 'done' || word === '}') {
        if (closers.pop() !== word) return undefined;
        commandPosition = false;
      } else if (word === '!') {
        if (closers.length === 0) negated = true;
      } else {
        commandPosition = false;
      }
    }
  }
  if (nested || closers.length > 0) return undefined;
  return { end: i, stageStarts, negated, commentInPipeline };
}

/** Return the offset after the shell word starting at `from`, or `undefined` if it is unterminated. */
function scanWord(src: string, from: number): number | undefined {
  let i = from;
  while (i < src.length) {
    const c = src[i]!;
    if (' \t\n;&|()<>'.includes(c)) return i;
    const next = scanQuotedPart(src, i, false);
    if (next === undefined) return undefined;
    i = next;
  }
  return i;
}

/**
 * Skip one character or quoted part of a word at `i`: a backslash escape, '...', "...", `...`,
 * $(...) or ${...}. Inside double quotes, single quotes are literal.
 */
function scanQuotedPart(src: string, i: number, inDoubleQuotes: boolean): number | undefined {
  const c = src[i]!;
  if (c === '\\') return i + 1 < src.length ? i + 2 : undefined;
  // bash's $'...' and $"..." quote differently from POSIX sh.
  if (c === '$' && (src[i + 1] === "'" || src[i + 1] === '"') && !inDoubleQuotes) return undefined;
  if (c === "'" && !inDoubleQuotes) {
    const close = src.indexOf("'", i + 1);
    return close === -1 ? undefined : close + 1;
  }
  if (c === '"') return scanUntil(src, i + 1, '"', true);
  if (c === '`') {
    for (let j = i + 1; j < src.length; j++) {
      if (src[j] === '\\') j++;
      else if (src[j] === '`') return j + 1;
    }
    return undefined;
  }
  if (c === '$' && src[i + 1] === '(') {
    const scan = scanCommandList(src, i + 2, true);
    return scan ? scan.end + 1 : undefined;
  }
  if (c === '$' && src[i + 1] === '{') return scanUntil(src, i + 2, '}', inDoubleQuotes);
  return i + 1;
}

/** Return the offset after the first unquoted `close` at or after `from`. */
function scanUntil(src: string, from: number, close: string, inDoubleQuotes: boolean): number | undefined {
  let i = from;
  while (i < src.length) {
    if (src[i] === close) return i + 1;
    const next = scanQuotedPart(src, i, inDoubleQuotes);
    if (next === undefined) return undefined;
    i = next;
  }
  return undefined;
}

/**
 * POSIX shells report a pipeline's status from its last command, so `cmd | tail -N` exits 0 even
 * when `cmd` fails. For pipelines ending in `tail`, report the status of the last failing stage
 * instead, as `pipefail` does. `tail` reads all of its input, so upstream commands are not cut off
 * by SIGPIPE.
 *
 * dash (`/bin/sh` on Debian and Ubuntu before 26.04) has no `pipefail`, so the final pipeline is
 * rewritten in POSIX `sh` for every shell: each stage before `tail` runs in a subshell, and its
 * wrapper writes the stage's status to fd 9, which a command substitution collects. Output reaches
 * the original stdout through fd 8. The configured shell still parses and expands every word, the
 * command text appears once, and no newlines are added, so error line numbers do not change.
 * Commands the scanner does not follow keep the `set -o pipefail` guard, which works where the
 * shell has `pipefail`. LocalSandbox on Windows runs commands through cmd.exe, which has neither.
 */
function reportUpstreamPipelineFailure(command: string, sandboxProvider: string): string {
  if (sandboxProvider === 'local' && process.platform === 'win32') return command;
  const trimmed = command.trimEnd();
  if (!TRAILING_TAIL_PIPE.test(trimmed.trim())) return command;
  const stages = USES_WRAPPER_FDS.test(trimmed) ? undefined : findTailPipelineStages(trimmed);
  if (!stages) return `(set -o pipefail) 2>/dev/null && set -o pipefail; ${command}`;

  const pipelineStart = stages[0]!.start;
  const before = trimmed.slice(0, pipelineStart);
  const tailStage = stages[stages.length - 1]!;
  const upstream = stages.slice(0, -1);
  // Each stage runs in its own subshell, which restores `set -e` or else the previous `$?`. The
  // wrapper around it runs without `set -e`, so it still reports the status to fd 9.
  const wrappedStages = upstream.map(
    ({ start, end }, index) =>
      `{ ( eval "$__mastra_pf_init"; ${trimmed.slice(start, end)} ) 8>&- 9>&-; echo "__mastra_pf_${index + 1}=$?" >&9; }`,
  );
  // pipefail semantics: the rightmost failing stage sets the status; `tail` is the rightmost.
  const rightmostFailure = upstream
    .map((_, index) => upstream.length - index)
    .map(n => `[ "$__mastra_pf_exit" -ne 0 ] || __mastra_pf_exit=\${__mastra_pf_${n}:-0}; `)
    .join('');
  return (
    `${before}${/^$|\s$/.test(before) ? '' : ' '}{ __mastra_pf_init="(exit $?)"; ` +
    `case $- in *e*) __mastra_pf_init='set -e';; esac; ` +
    `__mastra_pf_status=$(set +e; { ${wrappedStages.join(' | ')} | ` +
    `${trimmed.slice(tailStage.start, tailStage.end)} 8>&- 9>&-; } 9>&1 >&8); ` +
    `__mastra_pf_exit=$?; eval "$__mastra_pf_status"; ${rightmostFailure}` +
    `(exit "$__mastra_pf_exit"); } 8>&1${command.slice(trimmed.length)}`
  );
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

    // Wire exit callback (fire-and-forget). The observer runs after this tool has
    // already returned the PID, so any failure here has no live call frame to catch
    // it. Own the detached promise: await the callback so both synchronous throws and
    // rejected async callbacks land in the try/catch, and attach a terminal .catch()
    // for a rejected wait(), routing all failures to the logger so
    // neither escapes as a process-terminating unhandled rejection. Observation
    // failures are logged distinctly and never synthesize a successful exit.
    if (bgConfig?.onExit) {
      void handle
        .wait()
        .then(async result => {
          try {
            await bgConfig.onExit!({
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
        })
        .catch(observeError => {
          workspace.logger?.error('Failed to observe background process exit', {
            error: observeError,
            pid: handle.pid,
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
  // Bounded copies used only on the error path, where the sandbox result is unavailable.
  // Unbounded accumulation here crashes the process with RangeError on very large output.
  const stdout = new RetainedOutputBuffer(DEFAULT_MAX_RETAINED_PROCESS_OUTPUT_BYTES);
  const stderr = new RetainedOutputBuffer(DEFAULT_MAX_RETAINED_PROCESS_OUTPUT_BYTES);
  // Snapshot the abort state when the command settles: an abort that lands afterwards
  // (while the result is being reported) did not stop the command.
  let abortedWhenSettled = false;
  try {
    const result = await sandbox
      .executeCommand(reportUpstreamPipelineFailure(command, sandbox.provider), [], {
        timeout: timeout ?? undefined,
        cwd: cwd ?? undefined,
        abortSignal: context?.abortSignal, // foreground processes use agent's abort signal
        onStdout: async (data: string) => {
          stdout.append(data);
          await context?.writer?.custom({
            type: 'data-sandbox-stdout',
            data: { output: data, timestamp: Date.now(), toolCallId },
            transient: true,
          });
        },
        onStderr: async (data: string) => {
          stderr.append(data);
          await context?.writer?.custom({
            type: 'data-sandbox-stderr',
            data: { output: data, timestamp: Date.now(), toolCallId },
            transient: true,
          });
        },
      })
      .finally(() => {
        abortedWhenSettled = context?.abortSignal?.aborted === true;
      });

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

Set background: true to run long-running commands (dev servers, watchers) without blocking. You'll get a PID to track the process.`;

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
