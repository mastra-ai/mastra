/**
 * Seatbelt (macOS sandbox-exec)
 *
 * macOS built-in sandboxing using sandbox-exec with SBPL profiles.
 *
 * Important: Uses `-p` (inline profile) instead of `-f` (file) because
 * `-f` doesn't work reliably with path filters on modern macOS.
 *
 * Note on macOS sandbox limitations:
 * - `(allow file-read* (subpath ...))` only works WITH a preceding `(allow file-read*)`
 * - So for reads: allow all, then deny specific paths
 * - For writes: allow specific paths with subpath filters
 *
 * Based on the approach used by Claude Code's sandbox-runtime:
 * https://github.com/anthropic-experimental/sandbox-runtime
 */

import type { NativeSandboxConfig } from './types';

/**
 * Mach services needed for basic operation
 */
const MACH_SERVICES = [
  'com.apple.distributed_notifications@Uv3',
  'com.apple.logd',
  'com.apple.system.logger',
  'com.apple.system.notification_center',
  'com.apple.system.opendirectoryd.libinfo',
  'com.apple.system.opendirectoryd.membership',
  'com.apple.bsd.dirhelper',
  'com.apple.securityd.xpc',
  'com.apple.SecurityServer',
  'com.apple.trustd.agent',
];

/**
 * Escape a path for use in SBPL profile.
 * Uses JSON.stringify for proper escaping.
 */
function escapePath(pathStr: string): string {
  return JSON.stringify(pathStr);
}

/**
 * Generate a seatbelt profile for the given configuration.
 *
 * The profile:
 * - Allows all file reads (can't restrict with subpath on macOS)
 * - Restricts file writes to workspace and temp directories
 * - Blocks network unless explicitly allowed
 *
 * @param workspacePath - The workspace directory to allow write access to
 * @param config - Additional sandbox configuration
 * @returns The generated SBPL profile content
 */
export function generateSeatbeltProfile(workspacePath: string, config: NativeSandboxConfig): string {
  // Fail-closed: seatbelt cannot restrict process-exec, so reject unsupported config
  if (config.allowSystemBinaries === false) {
    throw new Error(
      'allowSystemBinaries: false is not supported by seatbelt (macOS). ' +
        'Use bubblewrap on Linux or remove this restriction.',
    );
  }

  const lines: string[] = [];

  // Version and default deny
  lines.push('(version 1)');
  lines.push('(deny default (with message "mastra-sandbox"))');
  lines.push('');

  // Process permissions
  lines.push('; Process permissions');
  lines.push('(allow process-exec)');
  lines.push('(allow process-fork)');
  lines.push('(allow process-info* (target same-sandbox))');
  lines.push('(allow signal (target same-sandbox))');
  lines.push('');

  // Mach IPC
  lines.push('; Mach IPC');
  lines.push('(allow mach-lookup');
  for (const service of MACH_SERVICES) {
    lines.push(`  (global-name "${service}")`);
  }
  lines.push(')');
  lines.push('');

  // IPC
  lines.push('; IPC');
  lines.push('(allow ipc-posix-shm)');
  lines.push('(allow ipc-posix-sem)');
  lines.push('');

  // User preferences
  lines.push('; User preferences');
  lines.push('(allow user-preference-read)');
  lines.push('');

  // sysctl
  lines.push('; sysctl');
  lines.push('(allow sysctl-read)');
  lines.push('');

  // Device files
  lines.push('; Device files');
  lines.push('(allow file-ioctl (literal "/dev/null"))');
  lines.push('(allow file-ioctl (literal "/dev/zero"))');
  lines.push('(allow file-ioctl (literal "/dev/random"))');
  lines.push('(allow file-ioctl (literal "/dev/urandom"))');
  lines.push('(allow file-ioctl (literal "/dev/tty"))');
  lines.push('');

  // File read access - allow all reads (macOS limitation: can't use subpath without this)
  lines.push('; File read access (allow all - macOS sandbox limitation)');
  lines.push('(allow file-read*)');

  // Add custom read-only paths as additional allows (technically redundant but explicit)
  for (const p of config.readOnlyPaths ?? []) {
    lines.push(`(allow file-read* (subpath ${escapePath(p)}))`);
  }
  lines.push('');

  // File write access - restrict to workspace and temp
  lines.push('; File write access (restricted to workspace and temp)');

  // Workspace
  lines.push(`(allow file-write* (subpath ${escapePath(workspacePath)}))`);

  // Temp directories (needed for many operations)
  lines.push('(allow file-write* (subpath "/private/tmp"))');
  lines.push('(allow file-write* (subpath "/var/folders"))');
  lines.push('(allow file-write* (subpath "/private/var/folders"))');

  // Custom read-write paths
  for (const p of config.readWritePaths ?? []) {
    lines.push(`(allow file-write* (subpath ${escapePath(p)}))`);
  }
  lines.push('');

  // Network
  lines.push('; Network');
  if (config.allowNetwork) {
    lines.push('(allow network*)');
  } else {
    lines.push('(deny network* (with message "mastra-sandbox-network"))');
  }

  return lines.join('\n');
}

/**
 * Build the command arguments for sandbox-exec.
 *
 * Uses `-p` (inline profile) instead of `-f` (file) because
 * `-f` doesn't work reliably with path filters on modern macOS.
 *
 * @param command - The full shell command string to run
 * @param profile - The SBPL profile content (not a file path)
 * @returns Wrapped command and arguments for sandbox-exec
 */
export function buildSeatbeltCommand(command: string, profile: string): { command: string; args: string[] } {
  return {
    command: 'sandbox-exec',
    args: ['-p', profile, 'sh', '-c', command],
  };
}
