import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { SandboxFeatureNotSupportedError } from '../errors';
import type { ProcessHandle } from '../sandbox/process-manager/process-handle';
import { coerceNumericString, emitWorkspaceMetadata, getDynamicSandboxCacheKeyHint, requireSandbox } from './helpers';
import { DEFAULT_TAIL_LINES, noteDroppedOutput, truncateOutput, sandboxToModelOutput } from './output-helpers';
import { startWorkspaceSpan } from './tracing';

const MAX_WAIT_SECONDS = 300;

const LEFT_BEHIND_NOTE =
  'The command exited, but a process it started is still running and holding its output open. Call kill_process to stop it.';

const ABORTED_PROCESS_NOTE =
  'Process aborted: the run that started or was waiting on this process was cancelled (by the user or system), so it was killed before it finished.';

export const getProcessOutputTool = createTool({
  id: WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT,
  description: `Get the current output (stdout, stderr) and status of a background process by its PID.

Use this after starting a background command with execute_command (background: true) to check if the process is still running and read its output. Pass waitSeconds to wait for it to finish first.`,
  toModelOutput: sandboxToModelOutput,
  outputSchema: z.string(),
  inputSchema: z.object({
    pid: z.string().describe('The process ID returned when the background command was started'),
    tail: z
      .preprocess(coerceNumericString, z.number().int())
      .optional()
      .describe(
        `Number of lines to return, similar to tail -n. Positive or negative returns last N lines from end. Defaults to ${DEFAULT_TAIL_LINES}. Use 0 for no limit.`,
      ),
    waitSeconds: z
      .preprocess(coerceNumericString, z.number().int().min(1).max(MAX_WAIT_SECONDS))
      .optional()
      .describe(
        `Wait up to this many seconds (max ${MAX_WAIT_SECONDS}) for the process to exit before returning. If it is still running when the wait ends, you get the output so far. Omit to return right away.`,
      ),
  }),
  execute: async ({ pid, tail, waitSeconds }, context) => {
    const { workspace, sandbox } = requireSandbox(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'sandbox',
      operation: 'getProcessOutput',
      input: { pid, tail, waitSeconds },
      attributes: { sandboxProvider: sandbox.provider },
    });

    const toolCallId = context?.agent?.toolCallId;

    try {
      if (!sandbox.processes) {
        throw new SandboxFeatureNotSupportedError('processes');
      }
      const handle = await sandbox.processes.get(pid);
      if (!handle) {
        span.end({ success: false });
        return `No background process found with PID ${pid}.${getDynamicSandboxCacheKeyHint(workspace)}`;
      }

      // Emit process info so the UI can display the command
      if (handle.command) {
        await context?.writer?.custom({
          type: 'data-sandbox-command',
          data: { command: handle.command, pid, toolCallId },
        });
      }

      // Wait for the exit, streaming output, for at most `waitSeconds`. A wait that runs out
      // leaves the process running. The run's abortSignal is forwarded, so aborting the run
      // (e.g. a user stop) kills the process, mirroring the spawn-time `abortSignal` convention.
      let result: Awaited<ReturnType<typeof handle.wait>> | undefined;
      const waited = waitSeconds !== undefined && handle.exitCode === undefined;
      if (waited) {
        result = await waitForExit(handle, waitSeconds * 1000, context?.abortSignal, (type, output) => {
          void context?.writer
            ?.custom({ type, data: { output, timestamp: Date.now(), toolCallId }, transient: true })
            .catch(() => {});
        });
      }

      if (result) {
        await context?.writer?.custom({
          type: 'data-sandbox-exit',
          data: {
            exitCode: result.exitCode,
            success: result.success,
            executionTimeMs: result.executionTimeMs,
            toolCallId,
          },
        });
      }

      // wait() can settle when the command exits while a process it left behind
      // still holds its output; the handle then reports no exit code yet.
      const exitCode = handle.exitCode ?? result?.exitCode;
      const running = exitCode === undefined;

      const tokenLimit = workspace.getToolsConfig()?.[WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT]?.maxOutputTokens;
      const stdout = noteDroppedOutput(
        await truncateOutput(handle.stdout, tail, tokenLimit, 'sandwich'),
        handle.stdoutDroppedBytes,
        'stdout',
      );
      const stderr = noteDroppedOutput(
        await truncateOutput(handle.stderr, tail, tokenLimit, 'sandwich'),
        handle.stderrDroppedBytes,
        'stderr',
      );

      const stillRunningNote =
        running && waited
          ? `Still running after waiting ${formatSeconds(waitSeconds)}. Call get_process_output again to keep waiting, or kill_process to stop it.`
          : undefined;

      if (running && !stdout && !stderr) {
        span.end({ success: true }, { exitCode: handle.exitCode });
        return stillRunningNote ? `(no output yet)\n\n${stillRunningNote}` : '(no output yet)';
      }

      const parts: string[] = [];

      // Only label stdout/stderr when both are present
      if (stdout && stderr) {
        parts.push('stdout:', stdout, '', 'stderr:', stderr);
      } else if (stdout) {
        parts.push(stdout);
      } else if (stderr) {
        parts.push('stderr:', stderr);
      }

      if (!running) {
        // The exit code of an aborted process is a provider-specific kill code, so say why it stopped.
        const terminalLines = [
          ...(handle.killedByAbort ? [ABORTED_PROCESS_NOTE] : []),
          ...(handle.exitCode === undefined ? [LEFT_BEHIND_NOTE] : []),
          `Exit code: ${exitCode}`,
        ];
        parts.push(...(parts.length > 0 ? [''] : []), ...terminalLines);
      } else if (stillRunningNote) {
        parts.push('', stillRunningNote);
      }

      span.end({ success: true }, { exitCode });
      return parts.join('\n');
    } catch (err) {
      span.error(err);
      throw err;
    }
  },
});

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

type OutputSink = (type: 'data-sandbox-stdout' | 'data-sandbox-stderr', data: string) => void;
type ExitResult = Awaited<ReturnType<ProcessHandle['wait']>>;

interface Reader {
  onOutput: OutputSink;
  resolve: (result: ExitResult) => void;
  reject: (error: unknown) => void;
}

interface ExitWait {
  readers: Set<Reader>;
  abort: AbortController;
}

/**
 * One wait per process, shared by every read of it. A handle keeps a wait's callbacks until the
 * process exits, so a wait per read would leave one more set behind each time a read ran out.
 * Reads join `readers` while they wait and leave when they stop, so nothing is kept per read.
 */
const exitWaits = new WeakMap<ProcessHandle, ExitWait>();

function exitWaitFor(handle: ProcessHandle): ExitWait {
  const existing = exitWaits.get(handle);
  if (existing) return existing;
  const readers = new Set<Reader>();
  const wait: ExitWait = { readers, abort: new AbortController() };
  exitWaits.set(handle, wait);
  const settle = (deliver: (reader: Reader) => void) => {
    if (exitWaits.get(handle) === wait) exitWaits.delete(handle);
    for (const reader of readers) deliver(reader);
    readers.clear();
  };
  handle
    .wait({
      abortSignal: wait.abort.signal,
      onStdout: data => {
        for (const reader of readers) reader.onOutput('data-sandbox-stdout', data);
      },
      onStderr: data => {
        for (const reader of readers) reader.onOutput('data-sandbox-stderr', data);
      },
    })
    .then(
      result => settle(reader => reader.resolve(result)),
      error => settle(reader => reader.reject(error)),
    );
  return wait;
}

/**
 * Wait for a process to exit, for at most `ms`. Returns undefined when the wait ran out
 * first; the process is left running. Aborting `abortSignal` during the wait kills the process.
 */
function waitForExit(
  handle: ProcessHandle,
  ms: number,
  abortSignal: AbortSignal | undefined,
  onOutput: OutputSink,
): Promise<ExitResult | undefined> {
  const { readers, abort } = exitWaitFor(handle);
  return new Promise<ExitResult | undefined>((resolve, reject) => {
    // Forward the run's abort only while this read is waiting, so an abort after the wait ran
    // out leaves the process alone.
    const onAbort = () => abort.abort(abortSignal?.reason);
    const leave = () => {
      clearTimeout(timer);
      readers.delete(reader);
      abortSignal?.removeEventListener('abort', onAbort);
    };
    const reader: Reader = {
      onOutput,
      resolve: result => {
        leave();
        resolve(result);
      },
      reject: error => {
        leave();
        reject(error);
      },
    };
    const timer = setTimeout(() => {
      leave();
      resolve(undefined);
    }, ms);
    readers.add(reader);
    if (abortSignal?.aborted) onAbort();
    else abortSignal?.addEventListener('abort', onAbort, { once: true });
  });
}
