import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { SandboxFeatureNotSupportedError } from '../errors';
import { emitWorkspaceMetadata, requireSandbox } from './helpers';

export const executeCommandTool = createTool({
  id: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
  description: `Execute a shell command in the workspace sandbox.

Usage:
- Verify parent directories exist before running commands that create files or directories.
- Always quote file paths that contain spaces (e.g., cd "/path/with spaces").
- Use the timeout parameter to limit execution time. Behavior when omitted depends on the sandbox provider.
- Optionally use cwd to override the working directory. Commands run from the sandbox default if omitted.`,
  inputSchema: z.object({
    command: z.string().describe('The command to execute (e.g., "ls", "npm", "python")'),
    args: z.array(z.string()).nullish().default([]).describe('Arguments to pass to the command'),
    timeout: z.number().nullish().describe('Maximum execution time in milliseconds. Example: 60000 for 1 minute.'),
    cwd: z.string().nullish().describe('Working directory for the command'),
  }),
  execute: async ({ command, args, timeout, cwd }, context) => {
    const { sandbox } = requireSandbox(context);

    if (!sandbox.executeCommand) {
      throw new SandboxFeatureNotSupportedError('executeCommand');
    }

    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);

    const toolCallId = context?.agent?.toolCallId;
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
        const parts = [result.stdout, result.stderr].filter(Boolean);
        parts.push(`Exit code: ${result.exitCode}`);
        return parts.join('\n');
      }

      return result.stdout || '(no output)';
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
      // Include any stdout/stderr captured before the error (e.g., timeout)
      const parts = [stdout, stderr].filter(Boolean);
      const errorMessage = error instanceof Error ? error.message : String(error);
      parts.push(`Error: ${errorMessage}`);
      return parts.join('\n');
    }
  },
});
