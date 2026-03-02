import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { SandboxFeatureNotSupportedError } from '../errors';
import { emitWorkspaceMetadata, requireSandbox } from './helpers';
import { DEFAULT_TAIL_LINES, truncateOutput, sandboxToModelOutput } from './output-helpers';

/**
 * Base input schema for execute_command (no background param).
 * Extended with `background` in tools.ts when sandbox.processes exists.
 */
export const executeCommandInputSchema = z.object({
  command: z
    .string()
    .describe('The shell command to execute (e.g., "npm install", "ls -la src/", "cat file.txt | grep error")'),
  timeout: z.number().nullish().describe('Maximum execution time in milliseconds. Example: 60000 for 1 minute.'),
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

/** Shared execute function used by both foreground-only and background-capable tool variants. */
async function executeCommand(input: Record<string, any>, context: any) {
  let { command, timeout, cwd, tail } = input;
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

  await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
  const toolCallId = context?.agent?.toolCallId;
  const toolConfig = workspace.getToolsConfig()?.[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND];
  const tokenLimit = toolConfig?.maxOutputTokens;
  const tokenFrom = 'sandwich' as const;

  // Background mode: spawn via process manager and return immediately
  if (background) {
    if (!sandbox.processes) {
      throw new SandboxFeatureNotSupportedError('processes');
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

    return `Started background process (PID: ${handle.pid})`;
  }

  // Foreground mode: execute and wait for completion
  if (!sandbox.executeCommand) {
    throw new SandboxFeatureNotSupportedError('executeCommand');
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
        });
      },
      onStderr: async (data: string) => {
        stderr += data;
        await context?.writer?.custom({
          type: 'data-sandbox-stderr',
          data: { output: data, timestamp: Date.now(), toolCallId },
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
- Use the timeout parameter to limit execution time. Behavior when omitted depends on the sandbox provider.
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
