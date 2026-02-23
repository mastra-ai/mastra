import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { SandboxFeatureNotSupportedError } from '../errors';
import { emitWorkspaceMetadata, requireSandbox } from './helpers';
import { DEFAULT_TAIL_LINES, truncateOutput } from './output-helpers';

export const getProcessOutputTool = createTool({
  id: WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT,
  description: `Get the current output (stdout, stderr) and status of a background process by its PID.

Use this after starting a background command with execute_command (background: true) to check if the process is still running and read its output.`,
  inputSchema: z.object({
    pid: z.number().describe('The process ID returned when the background command was started'),
    tail: z
      .number()
      .optional()
      .describe(
        `Number of lines to return, similar to tail -n. Positive or negative returns last N lines from end. Defaults to ${DEFAULT_TAIL_LINES}. Use 0 for no limit.`,
      ),
    wait: z
      .boolean()
      .optional()
      .describe(
        'If true, block until the process exits and return the final output. Useful for short-lived background commands where you want to wait for the result.',
      ),
  }),
  execute: async ({ pid, tail, wait: shouldWait }, context) => {
    const { sandbox } = requireSandbox(context);

    if (!sandbox.processes) {
      throw new SandboxFeatureNotSupportedError('processes');
    }

    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT);

    const toolCallId = context?.agent?.toolCallId;

    const handle = await sandbox.processes.get(pid);
    if (!handle) {
      return `No background process found with PID ${pid}.`;
    }

    // Emit process info so the UI can display the command
    if (handle.command) {
      await context?.writer?.custom({
        type: 'data-sandbox-command',
        data: { command: handle.command, pid, toolCallId },
      });
    }

    // If wait requested, block until process exits with streaming callbacks
    if (shouldWait && handle.exitCode === undefined) {
      const result = await handle.wait({
        onStdout: context?.writer
          ? async (data: string) => {
              await context.writer!.custom({
                type: 'data-sandbox-stdout',
                data: { output: data, timestamp: Date.now(), toolCallId },
              });
            }
          : undefined,
        onStderr: context?.writer
          ? async (data: string) => {
              await context.writer!.custom({
                type: 'data-sandbox-stderr',
                data: { output: data, timestamp: Date.now(), toolCallId },
              });
            }
          : undefined,
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
    }

    const running = handle.exitCode === undefined;

    const stdout = truncateOutput(handle.stdout, tail);
    const stderr = truncateOutput(handle.stderr, tail);

    if (!stdout && !stderr) {
      return '(no output yet)';
    }

    const parts: string[] = [];

    // Only label stdout/stderr when both are present
    if (stdout && stderr) {
      parts.push('stdout:', stdout, '', 'stderr:', stderr);
    } else if (stdout) {
      parts.push(stdout);
    } else {
      parts.push('stderr:', stderr);
    }

    if (!running) {
      parts.push('', `Exit code: ${handle.exitCode}`);
    }

    return parts.join('\n');
  },
});
