/**
 * Bubblewrap (Linux bwrap)
 *
 * Linux sandboxing using user namespaces and bind mounts.
 * https://github.com/containers/bubblewrap
 */

import type { NativeSandboxConfig } from './types';

/**
 * System paths to mount read-only by default.
 * These are needed for basic command execution.
 */
const DEFAULT_READONLY_BINDS = [
  '/usr',
  '/lib',
  '/lib64',
  '/bin',
  '/sbin',
  '/etc/alternatives',
  '/etc/ssl',
  '/etc/ca-certificates',
  '/etc/resolv.conf',
  '/etc/hosts',
  '/etc/passwd',
  '/etc/group',
  '/etc/nsswitch.conf',
  '/etc/ld.so.cache',
  '/etc/localtime',
];

/**
 * Build the bwrap command arguments for the given configuration.
 *
 * @param command - The full shell command string to run inside the sandbox
 * @param workspacePath - The workspace directory (mounted read-write)
 * @param config - Additional sandbox configuration
 * @returns Wrapped command and arguments for bwrap
 */
export function buildBwrapCommand(
  command: string,
  workspacePath: string,
  config: NativeSandboxConfig,
): { command: string; args: string[] } {
  // If custom bwrap args are provided, use them directly
  if (config.bwrapArgs && config.bwrapArgs.length > 0) {
    return {
      command: 'bwrap',
      args: [...config.bwrapArgs, '--', 'sh', '-c', command],
    };
  }

  const bwrapArgs: string[] = [];

  // Create new namespaces for isolation
  bwrapArgs.push('--unshare-pid'); // PID namespace (can't see host processes)
  bwrapArgs.push('--unshare-ipc'); // IPC namespace
  bwrapArgs.push('--unshare-uts'); // UTS namespace (separate hostname)

  // Network isolation (unless explicitly allowed)
  if (!config.allowNetwork) {
    bwrapArgs.push('--unshare-net');
  }

  // Mount a new /proc for the PID namespace
  bwrapArgs.push('--proc', '/proc');

  // Mount a tmpfs at /tmp
  bwrapArgs.push('--tmpfs', '/tmp');

  // Mount system paths read-only
  for (const path of DEFAULT_READONLY_BINDS) {
    // Use --ro-bind-try to skip paths that don't exist on this system
    bwrapArgs.push('--ro-bind-try', path, path);
  }

  // Mount custom read-only paths
  for (const path of config.readOnlyPaths ?? []) {
    bwrapArgs.push('--ro-bind', path, path);
  }

  // Allow system binaries by default (node, python, etc.)
  if (config.allowSystemBinaries !== false) {
    // Include the Node.js binary location
    const nodePath = process.execPath;
    const nodeDir = nodePath.substring(0, nodePath.lastIndexOf('/'));

    // Mount the node directory if it's not already covered
    if (!DEFAULT_READONLY_BINDS.some(p => nodeDir.startsWith(p))) {
      bwrapArgs.push('--ro-bind', nodeDir, nodeDir);
    }

    // Also mount common runtime locations
    bwrapArgs.push('--ro-bind-try', '/opt', '/opt');
    bwrapArgs.push('--ro-bind-try', '/snap', '/snap');
  }

  // Mount workspace read-write
  bwrapArgs.push('--bind', workspacePath, workspacePath);

  // Mount custom read-write paths
  for (const path of config.readWritePaths ?? []) {
    bwrapArgs.push('--bind', path, path);
  }

  // Set the working directory
  bwrapArgs.push('--chdir', workspacePath);

  // Die with parent (clean up if the parent process dies)
  bwrapArgs.push('--die-with-parent');

  // Add the command separator and run via sh -c for shell interpretation
  bwrapArgs.push('--', 'sh', '-c', command);

  return {
    command: 'bwrap',
    args: bwrapArgs,
  };
}
