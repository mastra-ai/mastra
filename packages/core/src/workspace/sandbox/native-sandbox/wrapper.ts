/**
 * Command Wrapper
 *
 * Wraps commands with the appropriate sandbox backend.
 */

import { buildBwrapCommand } from './bubblewrap';
import { buildSeatbeltCommand, generateSeatbeltProfile } from './seatbelt';
import type { IsolationBackend, NativeSandboxConfig } from './types';

export interface WrappedCommand {
  command: string;
  args: string[];
}

export interface WrapCommandOptions {
  /** The isolation backend to use */
  backend: IsolationBackend;
  /** The workspace directory path */
  workspacePath: string;
  /** Pre-generated seatbelt profile content (optional, will be generated if not provided) */
  seatbeltProfile?: string;
  /** Native sandbox configuration */
  config: NativeSandboxConfig;
}

/**
 * Wrap a command with the appropriate sandbox backend.
 *
 * @param command - The full shell command string to run
 * @param options - Wrapping options
 * @returns The wrapped command and arguments
 *
 * @example
 * ```typescript
 * const wrapped = wrapCommand('node script.js', {
 *   backend: 'seatbelt',
 *   workspacePath: '/workspace',
 *   config: { allowNetwork: false },
 * });
 * // wrapped.command = 'sandbox-exec'
 * // wrapped.args = ['-p', '<profile>', 'sh', '-c', 'node script.js']
 * ```
 */
export function wrapCommand(command: string, options: WrapCommandOptions): WrappedCommand {
  switch (options.backend) {
    case 'seatbelt': {
      const profile = options.seatbeltProfile ?? generateSeatbeltProfile(options.workspacePath, options.config);
      return buildSeatbeltCommand(command, profile);
    }

    case 'bwrap': {
      return buildBwrapCommand(command, options.workspacePath, options.config);
    }

    case 'none':
    default:
      return { command, args: [] };
  }
}
