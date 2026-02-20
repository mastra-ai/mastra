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

    const handle = await sandbox.processes.get(pid);
    if (!handle) {
      return `No background process found with PID ${pid}.`;
    }

    // If wait requested, block until process exits
    if (shouldWait && handle.exitCode === undefined) {
      await handle.wait();
    }

    const running = handle.exitCode === undefined;
    const parts: string[] = [];

    parts.push(`PID: ${pid}`);
    parts.push(`Status: ${running ? 'running' : `exited (code ${handle.exitCode})`}`);

    if (!running && !shouldWait) {
      // Process already exited and agent didn't request wait — output was
      // already returned by kill_process. Don't dump the buffer again.
      return parts.join('\n');
    }

    const stdout = truncateOutput(handle.stdout, tail);
    const stderr = truncateOutput(handle.stderr, tail);

    if (stdout) {
      parts.push('', '--- stdout ---', stdout);
    }
    if (stderr) {
      parts.push('', '--- stderr ---', stderr);
    }

    if (!stdout && !stderr) {
      parts.push('', '(no output yet)');
    }

    return parts.join('\n');
  },
});
