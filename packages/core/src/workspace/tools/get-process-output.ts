import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { SandboxFeatureNotSupportedError } from '../errors';
import { emitWorkspaceMetadata, requireSandbox } from './helpers';
import { DEFAULT_TAIL_LINES, truncateOutput, sandboxToModelOutput } from './output-helpers';
import { startWorkspaceSpan } from './tracing';

export const getProcessOutputTool = createTool({
  id: WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT,
  description: `Get the current output (stdout, stderr) and status of a background process by its PID.

Use this after starting a background command with execute_command (background: true) to check if the process is still running and read its output.`,
  toModelOutput: sandboxToModelOutput,
  inputSchema: z.object({
    pid: z.string().describe('The process ID returned when the background command was started'),
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
    const { workspace, sandbox } = requireSandbox(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'sandbox',
      operation: 'getProcessOutput',
      input: { pid, tail, wait: shouldWait },
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
                  transient: true,
                });
              }
            : undefined,
          onStderr: context?.writer
            ? async (data: string) => {
                await context.writer!.custom({
                  type: 'data-sandbox-stderr',
                  data: { output: data, timestamp: Date.now(), toolCallId },
                  transient: true,
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

      const tokenLimit = workspace.getToolsConfig()?.[WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT]?.maxOutputTokens;
      const stdout = await truncateOutput(handle.stdout, tail, tokenLimit, 'sandwich');
      const stderr = await truncateOutput(handle.stderr, tail, tokenLimit, 'sandwich');

      if (!stdout && !stderr) {
        span.end({ success: true }, { exitCode: handle.exitCode });
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

      span.end({ success: true }, { exitCode: handle.exitCode });
      return parts.join('\n');
    } catch (err) {
      span.error(err);
      throw err;
    }
  },
});
