import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { SandboxFeatureNotSupportedError } from '../errors';
import { emitWorkspaceMetadata, requireSandbox } from './helpers';
import { truncateOutput } from './output-helpers';

const KILL_TAIL_LINES = 50;

export const killProcessTool = createTool({
  id: WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS,
  description: `Kill a background process by its PID.

Use this to stop a long-running background process that was started with execute_command (background: true). Returns the last ${KILL_TAIL_LINES} lines of output.`,
  inputSchema: z.object({
    pid: z.number().describe('The process ID of the background process to kill'),
  }),
  execute: async ({ pid }, context) => {
    const { sandbox } = requireSandbox(context);

    if (!sandbox.processes) {
      throw new SandboxFeatureNotSupportedError('processes');
    }

    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS);
    const toolCallId = context?.agent?.toolCallId;

    // Snapshot output before kill
    const handle = await sandbox.processes.get(pid);

    // Emit command info so the UI can display the original command
    if (handle?.command) {
      await context?.writer?.custom({
        type: 'data-sandbox-command',
        data: { command: handle.command, pid, toolCallId },
      });
    }

    const killed = await sandbox.processes.kill(pid);

    if (!killed) {
      await context?.writer?.custom({
        type: 'data-sandbox-exit',
        data: { exitCode: handle?.exitCode ?? -1, success: false, killed: false, toolCallId },
      });
      return `Process ${pid} was not found or had already exited.`;
    }

    await context?.writer?.custom({
      type: 'data-sandbox-exit',
      data: { exitCode: handle?.exitCode ?? 137, success: false, killed: true, toolCallId },
    });

    const parts: string[] = [`Process ${pid} has been killed.`];

    if (handle) {
      const stdout = handle.stdout ? truncateOutput(handle.stdout, KILL_TAIL_LINES) : '';
      const stderr = handle.stderr ? truncateOutput(handle.stderr, KILL_TAIL_LINES) : '';

      if (stdout) {
        parts.push('', '--- stdout (last output) ---', stdout);
      }
      if (stderr) {
        parts.push('', '--- stderr (last output) ---', stderr);
      }
    }

    return parts.join('\n');
  },
});
