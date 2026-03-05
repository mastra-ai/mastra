import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { SandboxFeatureNotSupportedError } from '../errors';
import { emitWorkspaceMetadata, requireSandbox } from './helpers';
import { DEFAULT_TAIL_LINES, truncateOutput, sandboxToModelOutput } from './output-helpers';

export const getProcessOutputTool = createTool({
  id: WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT,
  description: `Get the current output (stdout, stderr) and status of a background process by its PID.

Use this after starting a background command with execute_command (background: true) to check if the process is still running and read its output.`,
  toModelOutput: sandboxToModelOutput,
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
    const { workspace, sandbox } = requireSandbox(context);

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
    let waitResult: { exitCode: number; success: boolean; executionTimeMs?: number } | undefined;
    if (shouldWait && handle.exitCode === undefined) {
      waitResult = await handle.wait({
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
    }

    const running = handle.exitCode === undefined;

    const tokenLimit = workspace.getToolsConfig()?.[WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT]?.maxOutputTokens;
    const stdoutResult = await truncateOutput(handle.stdout, tail, tokenLimit, 'sandwich');
    const stderrResult = await truncateOutput(handle.stderr, tail, tokenLimit, 'sandwich');

    if (!stdoutResult.text && !stderrResult.text) {
      return '(no output yet)';
    }

    const parts: string[] = [];

    // Only label stdout/stderr when both are present
    if (stdoutResult.text && stderrResult.text) {
      parts.push('stdout:', stdoutResult.text, '', 'stderr:', stderrResult.text);
    } else if (stdoutResult.text) {
      parts.push(stdoutResult.text);
    } else {
      parts.push('stderr:', stderrResult.text);
    }

    if (!running) {
      parts.push('', `Exit code: ${handle.exitCode}`);
    }

    const output = parts.join('\n');

    if (waitResult) {
      await context?.writer?.custom({
        type: 'data-sandbox-exit',
        data: {
          exitCode: waitResult.exitCode,
          success: waitResult.success,
          executionTimeMs: waitResult.executionTimeMs,
          outputTokensEstimate: stdoutResult.tokens + stderrResult.tokens,
          toolCallId,
        },
      });
    }

    return output;
  },
});
