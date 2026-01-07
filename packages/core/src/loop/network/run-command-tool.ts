/**
 * Node.js-specific tool for running shell commands.
 * This file is separated from validation.ts to avoid bundling Node.js
 * dependencies into browser builds.
 *
 * @security WARNING: This tool executes shell commands and can be dangerous.
 * - NEVER use with untrusted input or in multi-tenant environments
 * - Always configure allowedCommands to restrict executable commands
 * - Always set allowedBasePaths to restrict working directories
 * - Consider running in a sandboxed environment (container, VM)
 * - Review all commands that agents may construct before deployment
 */

import { exec } from 'node:child_process';
import { resolve, normalize } from 'node:path';
import { promisify } from 'node:util';

import { z } from 'zod';

import { createTool } from '../../tools';

const execAsync = promisify(exec);

/**
 * Characters that could enable shell injection attacks.
 * These are rejected when found in command input.
 */
const DANGEROUS_PATTERNS = [
  /[;&|`$(){}[\]<>]/g, // Shell metacharacters
  /\n|\r/g, // Newlines (command chaining)
  /\\(?![ ])/g, // Backslashes (except escaped spaces)
];

/**
 * Commands that are inherently dangerous and blocked by default.
 */
const BLOCKED_COMMANDS = [
  'rm',
  'rmdir',
  'del',
  'format',
  'mkfs',
  'dd',
  'shutdown',
  'reboot',
  'halt',
  'poweroff',
  'init',
  'kill',
  'killall',
  'pkill',
  'chmod',
  'chown',
  'chgrp',
  'sudo',
  'su',
  'passwd',
  'useradd',
  'userdel',
  'usermod',
  'groupadd',
  'visudo',
  'crontab',
  'systemctl',
  'service',
  'curl',
  'wget',
  'nc',
  'netcat',
  'ssh',
  'scp',
  'ftp',
  'telnet',
  'eval',
  'source',
  'exec',
];

export interface RunCommandToolOptions {
  /**
   * Allowlist of command prefixes that are permitted.
   * If empty, all non-blocked commands are allowed (less secure).
   * @example ['git', 'npm', 'node', 'ls', 'cat', 'echo']
   */
  allowedCommands?: string[];

  /**
   * Base paths where command execution is permitted.
   * The cwd parameter must resolve to a path under one of these directories.
   * If empty, any cwd is allowed (less secure).
   * @example ['/home/user/projects', '/tmp/workspace']
   */
  allowedBasePaths?: string[];

  /**
   * Additional commands to block beyond the default blocklist.
   */
  additionalBlockedCommands?: string[];

  /**
   * Maximum execution time in milliseconds.
   * @default 30000 (30 seconds)
   */
  maxTimeout?: number;

  /**
   * Maximum buffer size for stdout/stderr in bytes.
   * @default 1048576 (1MB)
   */
  maxBuffer?: number;

  /**
   * Whether to allow potentially dangerous shell metacharacters.
   * Setting this to true is NOT recommended.
   * @default false
   */
  allowUnsafeCharacters?: boolean;
}

/**
 * Validates that a path is under one of the allowed base paths.
 */
function isPathAllowed(targetPath: string, allowedBasePaths: string[]): boolean {
  if (allowedBasePaths.length === 0) return true;

  const normalizedTarget = normalize(resolve(targetPath));
  return allowedBasePaths.some(basePath => {
    const normalizedBase = normalize(resolve(basePath));
    return normalizedTarget === normalizedBase || normalizedTarget.startsWith(normalizedBase + '/');
  });
}

/**
 * Extracts the base command from a command string.
 */
function extractBaseCommand(command: string): string {
  const trimmed = command.trim();
  const firstSpace = trimmed.indexOf(' ');
  const baseCmd = firstSpace === -1 ? trimmed : trimmed.substring(0, firstSpace);
  // Handle paths like /usr/bin/git -> git
  const lastSlash = baseCmd.lastIndexOf('/');
  return lastSlash === -1 ? baseCmd : baseCmd.substring(lastSlash + 1);
}

/**
 * Creates a tool that lets agents run shell commands with security restrictions.
 *
 * @security WARNING: This tool executes shell commands. Even with restrictions,
 * it should NEVER be used with untrusted input. Always:
 * - Configure allowedCommands to restrict which commands can run
 * - Configure allowedBasePaths to restrict working directories
 * - Review agent prompts to understand what commands may be generated
 * - Consider additional sandboxing (containers, VMs) for production use
 *
 * @example
 * ```typescript
 * // Secure configuration with allowlists
 * const agent = new Agent({
 *   tools: {
 *     runCommand: createRunCommandTool({
 *       allowedCommands: ['git', 'npm', 'node'],
 *       allowedBasePaths: ['/home/user/project'],
 *       maxTimeout: 10000,
 *     }),
 *   },
 * });
 * ```
 */
export function createRunCommandTool(options: RunCommandToolOptions = {}) {
  const {
    allowedCommands = [],
    allowedBasePaths = [],
    additionalBlockedCommands = [],
    maxTimeout = 30000,
    maxBuffer = 1024 * 1024, // 1MB
    allowUnsafeCharacters = false,
  } = options;

  const blockedCommands = new Set([...BLOCKED_COMMANDS, ...additionalBlockedCommands.map(c => c.toLowerCase())]);

  return createTool({
    id: 'run-command',
    description:
      'Execute a shell command and return the result. Only permitted commands in allowed directories can be executed.',
    inputSchema: z.object({
      command: z.string().describe('The shell command to execute'),
      timeout: z.number().default(30000).describe('Timeout in milliseconds (capped by server configuration)'),
      cwd: z.string().optional().describe('Working directory (must be within allowed paths)'),
    }),
    execute: async ({ command, timeout, cwd }) => {
      // Validate: reject dangerous characters
      if (!allowUnsafeCharacters) {
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(command)) {
            return {
              success: false,
              exitCode: 1,
              stdout: '',
              stderr: '',
              message: `Command rejected: contains potentially unsafe characters. Pattern: ${pattern.source}`,
            };
          }
        }
      }

      // Validate: extract and check base command
      const baseCommand = extractBaseCommand(command).toLowerCase();

      // Check blocked commands
      if (blockedCommands.has(baseCommand)) {
        return {
          success: false,
          exitCode: 1,
          stdout: '',
          stderr: '',
          message: `Command rejected: '${baseCommand}' is not permitted for security reasons`,
        };
      }

      // Check allowlist if configured
      if (allowedCommands.length > 0) {
        const isAllowed = allowedCommands.some(allowed => baseCommand === allowed.toLowerCase());
        if (!isAllowed) {
          return {
            success: false,
            exitCode: 1,
            stdout: '',
            stderr: '',
            message: `Command rejected: '${baseCommand}' is not in the allowed commands list`,
          };
        }
      }

      // Validate: check cwd against allowed base paths
      if (cwd && !isPathAllowed(cwd, allowedBasePaths)) {
        return {
          success: false,
          exitCode: 1,
          stdout: '',
          stderr: '',
          message: `Command rejected: working directory '${cwd}' is not within allowed paths`,
        };
      }

      // Apply timeout cap
      const effectiveTimeout = Math.min(timeout || maxTimeout, maxTimeout);

      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: effectiveTimeout,
          cwd,
          maxBuffer,
          env: {
            ...process.env,
            // Restrict PATH to reduce attack surface (optional hardening)
            // PATH: '/usr/local/bin:/usr/bin:/bin',
          },
        });
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
