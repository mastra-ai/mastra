import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { SandboxFeatureNotSupportedError } from '../errors';
import { emitWorkspaceMetadata, requireSandbox } from './helpers';
import { DEFAULT_TAIL_LINES, truncateOutput } from './output-helpers';

/**
 * Base input schema for execute_command (no background param).
 * Extended with `background` in tools.ts when sandbox.processes exists.
 */
export const executeCommandInputSchema = z.object({
  command: z.string().describe('The command to execute (e.g., "ls", "npm", "python")'),
  args: z.array(z.string()).nullish().default([]).describe('Arguments to pass to the command'),
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

/** Shared execute function used by both foreground-only and background-capable tool variants. */
async function executeCommand(input: Record<string, any>, context: any) {
  const { command, args, timeout, cwd, tail } = input;
  const background = input.background as boolean | undefined;
  const { sandbox } = requireSandbox(context);

  await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
  const toolCallId = context?.agent?.toolCallId;

  // Background mode: spawn via process manager and return immediately
  if (background) {
    if (!sandbox.processes) {
      throw new SandboxFeatureNotSupportedError('processes');
    }

    const fullCommand = args?.length ? `${command} ${(args as string[]).join(' ')}` : command;
    const handle = await sandbox.processes.spawn(fullCommand, {
      cwd: cwd ?? undefined,
      timeout: timeout ?? undefined,
    });

    return [
      `Background process started (PID: ${handle.pid})`,
      `Command: ${fullCommand}`,
      '',
      `Use ${WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT} with pid ${handle.pid} to check output.`,
      `Use ${WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS} with pid ${handle.pid} to stop it.`,
    ].join('\n');
  }

  // Foreground mode: execute and wait for completion
  if (!sandbox.executeCommand) {
    throw new SandboxFeatureNotSupportedError('executeCommand');
  }

  const startedAt = Date.now();
  let stdout = '';
  let stderr = '';
  try {
    const result = await sandbox.executeCommand(command, args ?? [], {
      timeout: timeout ?? undefined,
      cwd: cwd ?? undefined,
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
      const parts = [truncateOutput(result.stdout, tail), truncateOutput(result.stderr, tail)].filter(Boolean);
      parts.push(`Exit code: ${result.exitCode}`);
      return parts.join('\n');
    }

    return truncateOutput(result.stdout, tail) || '(no output)';
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
    const parts = [truncateOutput(stdout, tail), truncateOutput(stderr, tail)].filter(Boolean);
    const errorMessage = error instanceof Error ? error.message : String(error);
    parts.push(`Error: ${errorMessage}`);
    return parts.join('\n');
  }
}

/** Foreground-only tool (no background param in schema). */
export const executeCommandTool = createTool({
  id: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
  description: `Execute a shell command in the workspace sandbox.

Usage:
- Verify parent directories exist before running commands that create files or directories.
- Always quote file paths that contain spaces (e.g., cd "/path/with spaces").
- Use the timeout parameter to limit execution time. Behavior when omitted depends on the sandbox provider.
- Optionally use cwd to override the working directory. Commands run from the sandbox default if omitted.`,
  inputSchema: executeCommandInputSchema,
  execute: executeCommand,
});

/** Tool with background param in schema (used when sandbox.processes exists). */
export const executeCommandWithBackgroundTool = createTool({
  id: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
  description: `Execute a shell command in the workspace sandbox.

Usage:
- Verify parent directories exist before running commands that create files or directories.
- Always quote file paths that contain spaces (e.g., cd "/path/with spaces").
- Use the timeout parameter to limit execution time. Behavior when omitted depends on the sandbox provider.
- Optionally use cwd to override the working directory. Commands run from the sandbox default if omitted.

Set background: true to run long-running commands (dev servers, watchers) without blocking. You'll get a PID to track the process.`,
  inputSchema: executeCommandWithBackgroundSchema,
  execute: executeCommand,
});
