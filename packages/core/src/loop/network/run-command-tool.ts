/**
 * Node.js-specific tool for running shell commands.
 * This file is separated from validation.ts to avoid bundling Node.js
 * dependencies into browser builds.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

import { z } from 'zod';

import { createTool } from '../../tools';

const execAsync = promisify(exec);

/**
 * Creates a tool that lets agents run shell commands.
 *
 * @example
 * ```typescript
 * const agent = new Agent({
 *   tools: { runCommand: createRunCommandTool() },
 * });
 * ```
 */
export function createRunCommandTool() {
  return createTool({
    id: 'run-command',
    description: 'Execute a shell command and return the result.',
    inputSchema: z.object({
      command: z.string().describe('The shell command to execute'),
      timeout: z.number().default(60000).describe('Timeout in milliseconds'),
      cwd: z.string().optional().describe('Working directory'),
    }),
    execute: async ({ command, timeout, cwd }) => {
      try {
        const { stdout, stderr } = await execAsync(command, { timeout, cwd });
        return {
          success: true,
          exitCode: 0,
          stdout: stdout.slice(-3000),
          stderr: stderr.slice(-1000),
        };
      } catch (error: any) {
        return {
          success: false,
          exitCode: error.code,
          stdout: error.stdout?.slice(-2000),
          stderr: error.stderr?.slice(-2000),
          message: error.message,
        };
      }
    },
  });
}
