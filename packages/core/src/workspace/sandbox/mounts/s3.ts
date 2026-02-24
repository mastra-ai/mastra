/**
 * S3 mount helper using s3fs-fuse for local sandboxes.
 *
 * **Platform support:**
 * - **Linux** — Install via `sudo apt-get install -y s3fs`
 * - **macOS** — The standard Homebrew formula (`brew install s3fs`) requires Linux.
 *   Use the macOS FUSE tap instead: `brew install gromgit/fuse/s3fs-mac`.
 *   Requires macFUSE (`brew install --cask macfuse`).
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
import { LOG_PREFIX, MountToolNotFoundError, validateBucketName, validateEndpoint } from './types';
import type { LocalMountContext } from './types';

/**
 * S3 mount config for local sandbox (mounted via s3fs-fuse).
 */
export interface LocalS3MountConfig extends FilesystemMountConfig {
  type: 's3';
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  readOnly?: boolean;
}

/**
 * Mount an S3 bucket using s3fs-fuse on the host.
 */
export async function mountS3(mountPath: string, config: LocalS3MountConfig, ctx: LocalMountContext): Promise<void> {
  const { logger } = ctx;

  // Validate inputs
  validateBucketName(config.bucket);
  if (config.endpoint) {
    validateEndpoint(config.endpoint);
  }

  // Check if s3fs is installed (no auto-install on host)
  const s3fsPath = await findTool('s3fs', ctx);
  if (!s3fsPath) {
    const instructions = getInstallInstructions('s3fs', ctx.platform);
    throw new MountToolNotFoundError(`s3fs is not installed. ${instructions}`);
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

  // Determine credentials mode
  const hasCredentials = !!(config.accessKeyId && config.secretAccessKey);

  // S3-compatible services require credentials
  if (!hasCredentials && config.endpoint) {
    throw new Error(
      `S3-compatible storage requires credentials. ` +
        `Detected endpoint: ${config.endpoint}. ` +
        `The public_bucket option only works for AWS S3 public buckets, not R2, MinIO, etc.`,
    );
  }

  // Namespaced credentials file
  const credHash = crypto.createHash('sha256').update(mountPath).digest('hex').slice(0, 8);
  const credDir = '/tmp/.mastra-mounts';
  const credPath = path.join(credDir, `.passwd-s3fs-${credHash}`);

  try {
    if (hasCredentials) {
      // Write credentials file
      await fs.mkdir(credDir, { recursive: true });
      await fs.writeFile(credPath, `${config.accessKeyId}:${config.secretAccessKey}`, { mode: 0o600 });
    }

    // Build mount options
    const mountOptions: string[] = [];

    if (hasCredentials) {
      mountOptions.push(`passwd_file=${credPath}`);
    } else {
      mountOptions.push('public_bucket=1');
      logger.debug(`${LOG_PREFIX} No credentials provided, mounting as public bucket (read-only)`);
    }

    mountOptions.push('allow_other');

    if (uid && gid) {
      mountOptions.push(`uid=${uid}`, `gid=${gid}`);
    }

    if (config.endpoint) {
      const endpoint = config.endpoint.replace(/\/$/, '');
      mountOptions.push(`url=${endpoint}`, 'use_path_request_style', 'sigv4', 'nomultipart');
    }

    if (config.readOnly) {
      mountOptions.push('ro');
      logger.debug(`${LOG_PREFIX} Mounting as read-only`);
    }

    // Build s3fs args
    const s3fsArgs = [config.bucket, mountPath, '-o', mountOptions.join(',')];

    logger.debug(
      `${LOG_PREFIX} Mounting S3:`,
      hasCredentials ? `s3fs ${config.bucket} ${mountPath} -o ***` : `s3fs ${s3fsArgs.join(' ')}`,
    );

    // Try without sudo first (user-space FUSE)
    const result = await ctx.run('s3fs', s3fsArgs, { timeout: 60_000 });

    if (result.exitCode !== 0) {
      // Retry with sudo if permission error
      if (result.stderr.includes('Permission denied') || result.stderr.includes('fuse: failed to open /dev/fuse')) {
        logger.debug(`${LOG_PREFIX} Permission error, retrying with sudo...`);
        const sudoResult = await ctx.run('sudo', ['s3fs', ...s3fsArgs], { timeout: 60_000 });
        if (sudoResult.exitCode !== 0) {
          throw new Error(`Failed to mount S3 bucket: ${sudoResult.stderr || sudoResult.stdout}`);
        }
      } else {
        throw new Error(`Failed to mount S3 bucket: ${result.stderr || result.stdout}`);
      }
    }
  } finally {
    // Clean up credentials file
    if (hasCredentials) {
      try {
        await fs.unlink(credPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
