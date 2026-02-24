/**
 * Platform-specific FUSE utilities for local mount operations.
 *
 * Provides cross-platform helpers for detecting mount points,
 * listing active FUSE mounts, unmounting, and finding tools.
 */

import * as nodeFs from 'node:fs';

import { LOG_PREFIX } from './types';
import type { LocalMountContext } from './types';

/**
 * Check if a path is a mount point.
 *
 * - Linux: uses `mountpoint -q`
 * - macOS: parses `mount` output
 */
export async function isMountPoint(mountPath: string, ctx: LocalMountContext): Promise<boolean> {
  try {
    if (ctx.platform === 'linux') {
      const result = await ctx.run('mountpoint', ['-q', mountPath]);
      return result.exitCode === 0;
    }

    // macOS: parse `mount` output for the path
    const result = await ctx.run('mount', []);
    return result.stdout.split('\n').some(line => line.includes(` on ${mountPath} `));
  } catch {
    return false;
  }
}

/**
 * Get all active FUSE mounts (s3fs, gcsfuse) on the system.
 * Returns an array of mount paths.
 *
 * - Linux: greps /proc/mounts for fuse.s3fs|fuse.gcsfuse
 * - macOS: parses `mount` output for macfuse/osxfuse entries
 */
export async function getActiveFuseMounts(ctx: LocalMountContext): Promise<string[]> {
  try {
    if (ctx.platform === 'linux') {
      const result = await ctx.run('sh', ['-c', "grep -E 'fuse\\.(s3fs|gcsfuse)' /proc/mounts | awk '{print $2}'"]);
      if (result.exitCode !== 0) return [];
      return result.stdout
        .trim()
        .split('\n')
        .filter(p => p.length > 0);
    }

    // macOS: look for macfuse/osxfuse entries
    const result = await ctx.run('mount', []);
    if (result.exitCode !== 0) return [];
    return result.stdout
      .split('\n')
      .filter(line => /macfuse|osxfuse|s3fs|gcsfuse/.test(line))
      .map(line => {
        const match = line.match(/ on (.+?) \(/);
        return match?.[1] ?? '';
      })
      .filter(p => p.length > 0);
  } catch {
    return [];
  }
}

/**
 * Unmount a FUSE mount point.
 *
 * - Linux: `fusermount -u`, fallback `umount`, lazy fallback `umount -l`
 * - macOS: `umount`, fallback `diskutil unmount`
 */
export async function unmountFuse(mountPath: string, ctx: LocalMountContext): Promise<void> {
  if (ctx.platform === 'linux') {
    // Try fusermount first (preferred for FUSE)
    const result = await ctx.run('fusermount', ['-u', mountPath]);
    if (result.exitCode === 0) return;

    ctx.logger.debug(`${LOG_PREFIX} fusermount failed, trying umount: ${result.stderr}`);
    const umountResult = await ctx.run('umount', [mountPath]);
    if (umountResult.exitCode === 0) return;

    ctx.logger.debug(`${LOG_PREFIX} umount failed, trying lazy unmount: ${umountResult.stderr}`);
    const lazyResult = await ctx.run('umount', ['-l', mountPath]);
    if (lazyResult.exitCode !== 0) {
      throw new Error(`Failed to unmount ${mountPath}: ${lazyResult.stderr}`);
    }
    return;
  }

  // macOS
  const result = await ctx.run('umount', [mountPath]);
  if (result.exitCode === 0) return;

  ctx.logger.debug(`${LOG_PREFIX} umount failed, trying diskutil: ${result.stderr}`);
  const diskutilResult = await ctx.run('diskutil', ['unmount', mountPath]);
  if (diskutilResult.exitCode !== 0) {
    throw new Error(`Failed to unmount ${mountPath}: ${diskutilResult.stderr}`);
  }
}

/**
 * Find a tool by name using `which`.
 * Returns the path if found, null otherwise.
 */
export async function findTool(name: string, ctx: LocalMountContext): Promise<string | null> {
  try {
    const result = await ctx.run('which', [name]);
    if (result.exitCode === 0 && result.stdout.trim()) {
      return result.stdout.trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if macFUSE is installed on macOS.
 *
 * Uses a synchronous top-level `import * as nodeFs from 'node:fs'` to avoid
 * the ESM compatibility issue where `require('node:fs')` compiles to a Proxy
 * shim (`__require("fs")`) that silently fails in ESM builds.
 */
export function checkMacFuse(): boolean {
  try {
    return nodeFs.existsSync('/Library/Filesystems/macfuse.fs');
  } catch {
    return false;
  }
}

/**
 * Get platform-specific install instructions for a FUSE tool.
 *
 * **Notes on macOS:**
 * - s3fs: The standard `brew install s3fs` formula requires Linux.
 *   Use the macOS FUSE tap: `brew install gromgit/fuse/s3fs-mac`
 * - gcsfuse: Not officially supported on macOS (Linux-only).
 *   A community tap exists (`brew install gromgit/fuse/gcsfuse-mac`)
 *   but is not maintained by Google — see
 *   https://github.com/GoogleCloudPlatform/gcsfuse/issues/1299
 */
export function getInstallInstructions(tool: 's3fs' | 'gcsfuse' | 'macfuse', platform: NodeJS.Platform): string {
  const instructions: Record<string, Record<string, string>> = {
    s3fs: {
      darwin:
        'Install s3fs for macOS: brew install gromgit/fuse/s3fs-mac\n' +
        '  (requires macFUSE: brew install --cask macfuse)\n' +
        '  Note: the standard `brew install s3fs` formula is Linux-only.',
      linux: 'Install s3fs via apt: sudo apt-get install -y s3fs',
    },
    gcsfuse: {
      darwin:
        'gcsfuse is not officially supported on macOS.\n' +
        '  Community tap (unsupported): brew install gromgit/fuse/gcsfuse-mac\n' +
        '  See: https://github.com/GoogleCloudPlatform/gcsfuse/issues/1299',
      linux:
        'Install gcsfuse: see https://cloud.google.com/storage/docs/gcsfuse-install\n' +
        '  sudo apt-get install -y gcsfuse',
    },
    macfuse: {
      darwin: 'Install macFUSE: brew install --cask macfuse\n  (or download from https://osxfuse.github.io)',
      linux: 'macFUSE is not needed on Linux (FUSE is built-in)',
    },
  };

  return instructions[tool]?.[platform] ?? `Install ${tool} for your platform`;
}
