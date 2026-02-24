/**
 * GCS mount helper using gcsfuse for local sandboxes.
 *
 * **Platform support:**
 * - **Linux** — Officially supported. Install via `sudo apt-get install -y gcsfuse`
 *   or see https://cloud.google.com/storage/docs/gcsfuse-install
 * - **macOS** — Not officially supported by Google (see
 *   https://github.com/GoogleCloudPlatform/gcsfuse/issues/1299).
 *   A community tap exists (`brew install gromgit/fuse/gcsfuse-mac`) but is
 *   not tested or maintained by the gcsfuse team. Requires macFUSE.
 *
 * Key differences from E2B:
 * - No auto-install: throws MountToolNotFoundError with platform-specific instructions
 * - No sudo: FUSE is user-space on host; only retries with sudo if initial mount fails with permission error
 * - Credentials written to namespaced temp file with cleanup in finally block
 * - macFUSE check on macOS before attempting mount
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { FilesystemMountConfig } from '../../filesystem/mount';

import { checkMacFuse, findTool, getInstallInstructions } from './platform';
import { LOG_PREFIX, MountToolNotFoundError, validateBucketName } from './types';
import type { LocalMountContext } from './types';

/**
 * GCS mount config for local sandbox (mounted via gcsfuse).
 */
export interface LocalGCSMountConfig extends FilesystemMountConfig {
  type: 'gcs';
  bucket: string;
  serviceAccountKey?: string;
}

/**
 * Mount a GCS bucket using gcsfuse on the host.
 */
export async function mountGCS(mountPath: string, config: LocalGCSMountConfig, ctx: LocalMountContext): Promise<void> {
  const { logger } = ctx;

  // Validate inputs
  validateBucketName(config.bucket);

  // Check if gcsfuse is installed (no auto-install on host)
  const gcsfusePath = await findTool('gcsfuse', ctx);
  if (!gcsfusePath) {
    const instructions = getInstallInstructions('gcsfuse', ctx.platform);
    throw new MountToolNotFoundError(`gcsfuse is not installed. ${instructions}`);
  }

  // macOS: verify macFUSE is installed
  if (ctx.platform === 'darwin' && !checkMacFuse()) {
    const instructions = getInstallInstructions('macfuse', ctx.platform);
    throw new MountToolNotFoundError(`macFUSE is required for FUSE mounts on macOS. ${instructions}`);
  }

  // Get uid/gid for proper file ownership
  const idResult = await ctx.run('id', ['-u']);
  const gidResult = await ctx.run('id', ['-g']);
  const uid = idResult.stdout.trim();
  const gid = gidResult.stdout.trim();

  const hasCredentials = !!config.serviceAccountKey;

  // Namespaced credentials file
  const credHash = crypto.createHash('sha256').update(mountPath).digest('hex').slice(0, 8);
  const credDir = '/tmp/.mastra-mounts';
  const keyPath = path.join(credDir, `.gcs-key-${credHash}.json`);

  try {
    if (hasCredentials) {
      await fs.mkdir(credDir, { recursive: true });
      await fs.writeFile(keyPath, config.serviceAccountKey!, { mode: 0o600 });
    }

    // Build gcsfuse args
    const gcsfuseArgs: string[] = [];

    if (hasCredentials) {
      gcsfuseArgs.push(`--key-file=${keyPath}`);
    } else {
      gcsfuseArgs.push('--anonymous-access');
      logger.debug(`${LOG_PREFIX} No credentials provided, mounting GCS as public bucket (read-only)`);
    }

    gcsfuseArgs.push('-o', 'allow_other');

    if (uid && gid) {
      gcsfuseArgs.push(`--uid=${uid}`, `--gid=${gid}`);
    }

    gcsfuseArgs.push(config.bucket, mountPath);

    logger.debug(`${LOG_PREFIX} Mounting GCS: gcsfuse ${gcsfuseArgs.join(' ')}`);

    // Try without sudo first (user-space FUSE)
    const result = await ctx.run('gcsfuse', gcsfuseArgs, { timeout: 60_000 });

    if (result.exitCode !== 0) {
      // Retry with sudo if permission error
      if (result.stderr.includes('Permission denied') || result.stderr.includes('fuse: failed to open /dev/fuse')) {
        logger.debug(`${LOG_PREFIX} Permission error, retrying with sudo...`);
        const sudoResult = await ctx.run('sudo', ['gcsfuse', ...gcsfuseArgs], { timeout: 60_000 });
        if (sudoResult.exitCode !== 0) {
          throw new Error(`Failed to mount GCS bucket: ${sudoResult.stderr || sudoResult.stdout}`);
        }
      } else {
        throw new Error(`Failed to mount GCS bucket: ${result.stderr || result.stdout}`);
      }
    }
  } finally {
    // Clean up credentials file
    if (hasCredentials) {
      try {
        await fs.unlink(keyPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
