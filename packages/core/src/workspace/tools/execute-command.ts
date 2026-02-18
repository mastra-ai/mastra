import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { SandboxFeatureNotSupportedError } from '../errors';
import { requireSandbox } from './helpers';

export const executeCommandTool = createTool({
  id: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
  description: `Execute a shell command in the workspace sandbox.

Usage:
- Verify parent directories exist before running commands that create files or directories.
- Always quote file paths that contain spaces (e.g., cd "/path/with spaces").
- Use the timeout parameter to limit execution time. Behavior when omitted depends on the sandbox provider.
- Use cwd to set the working directory, or commands run from the sandbox default.`,
  inputSchema: z.object({
    command: z.string().describe('The command to execute (e.g., "ls", "npm", "python")'),
    args: z.array(z.string()).nullish().default([]).describe('Arguments to pass to the command'),
    timeout: z.number().nullish().describe('Maximum execution time in milliseconds. Example: 60000 for 1 minute.'),
    cwd: z.string().nullish().describe('Working directory for the command'),
  }),
  execute: async ({ command, args, timeout, cwd }, context) => {
    const { workspace, sandbox } = requireSandbox(context);

    if (!sandbox.executeCommand) {
      throw new SandboxFeatureNotSupportedError('executeCommand');
    }

    const getExecutionMetadata = () => ({
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
      sandbox: {
        id: sandbox.id,
        name: sandbox.name,
        provider: sandbox.provider,
        status: sandbox.status,
      },
    });

    const startedAt = Date.now();
    try {
      const result = await sandbox.executeCommand(command, args ?? [], {
        timeout: timeout ?? undefined,
        cwd: cwd ?? undefined,
        onStdout: async (data: string) => {
          await context?.writer?.custom({
            type: 'data-sandbox-stdout',
            data: {
              data,
              timestamp: Date.now(),
              metadata: getExecutionMetadata(),
            },
          });
        },
        onStderr: async (data: string) => {
          await context?.writer?.custom({
            type: 'data-sandbox-stderr',
            data: {
              data,
              timestamp: Date.now(),
              metadata: getExecutionMetadata(),
            },
          });
        },
      });

      await context?.writer?.custom({
        type: 'data-sandbox-exit',
        data: {
          exitCode: result.exitCode,
          success: result.success,
          executionTimeMs: result.executionTimeMs,
          metadata: getExecutionMetadata(),
        },
      });

      await context?.writer?.custom({
        type: 'data-workspace-metadata',
        data: {
          toolName: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
          command,
          exitCode: result.exitCode,
          executionTimeMs: result.executionTimeMs,
          ...getExecutionMetadata(),
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
          metadata: getExecutionMetadata(),
        },
      });
      throw error;
    }
  },
});
