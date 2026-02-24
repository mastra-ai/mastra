import crypto from 'node:crypto';

import type { FilesystemMountConfig } from '@mastra/core/workspace';

import { shellQuote } from '../../utils/shell-quote';
import { LOG_PREFIX, validateBucketName, validateEndpoint, runCommand } from './types';
import type { MountContext } from './types';

/**
 * S3 mount config for Blaxel (mounted via s3fs-fuse).
 *
 * If credentials are not provided, the bucket will be mounted as read-only
 * using the `public_bucket=1` option (for public AWS S3 buckets only).
 *
 * Note: S3-compatible services (R2, MinIO, etc.) always require credentials.
 */
export interface BlaxelS3MountConfig extends FilesystemMountConfig {
  type: 's3';
  /** S3 bucket name */
  bucket: string;
  /** AWS region */
  region: string;
  /** S3 endpoint for S3-compatible storage (MinIO, etc.) */
  endpoint?: string;
  /** AWS access key ID (optional - omit for public buckets) */
  accessKeyId?: string;
  /** AWS secret access key (optional - omit for public buckets) */
  secretAccessKey?: string;
  /** Mount as read-only (even if credentials have write access) */
  readOnly?: boolean;
}

/**
 * Mount an S3 bucket using s3fs-fuse.
 */
export async function mountS3(mountPath: string, config: BlaxelS3MountConfig, ctx: MountContext): Promise<void> {
  const { sandbox, logger } = ctx;

  // Validate inputs before interpolating into shell commands
  validateBucketName(config.bucket);
  if (config.endpoint) {
    validateEndpoint(config.endpoint);
  }

  // Check if s3fs is installed
  const checkResult = await runCommand(sandbox, 'which s3fs || echo "not found"');
  if (checkResult.stdout.includes('not found')) {
    logger.warn(`${LOG_PREFIX} s3fs not found, attempting runtime installation...`);
    logger.info(`${LOG_PREFIX} Tip: For faster startup, pre-install s3fs in your sandbox image`);

    const updateResult = await runCommand(sandbox, 'apt-get update 2>&1', { timeout: 60000 });
    if (updateResult.exitCode !== 0) {
      throw new Error(
        `Failed to update package lists for s3fs installation.\n` +
          `Error details: ${updateResult.stderr || updateResult.stdout}`,
      );
    }

    const installResult = await runCommand(
      sandbox,
      'apt-get install -y s3fs fuse 2>&1 || apt-get install -y s3fs-fuse fuse 2>&1',
      { timeout: 120000 },
    );

    if (installResult.exitCode !== 0) {
      throw new Error(
        `Failed to install s3fs. ` +
          `For S3 mounting, your sandbox image needs s3fs and fuse packages.\n\n` +
          `Pre-install in your image: apt-get install -y s3fs fuse\n\n` +
          `Error details: ${installResult.stderr || installResult.stdout}`,
      );
    }
  }

  // Get user's uid/gid for proper file ownership
  const idResult = await runCommand(sandbox, 'id -u && id -g');
  if (idResult.exitCode !== 0) {
    throw new Error(`Failed to get uid/gid: ${idResult.stderr || idResult.stdout}`);
  }
  const [uid, gid] = idResult.stdout.trim().split('\n');

  // Determine if we have credentials or using public bucket mode
  const hasCredentials = config.accessKeyId && config.secretAccessKey;

  // Use a mount-specific credentials path to avoid races with concurrent mounts
  const mountHash = crypto.createHash('md5').update(mountPath).digest('hex').slice(0, 8);
  const credentialsPath = `/tmp/.passwd-s3fs-${mountHash}`;

  // S3-compatible services (R2, MinIO, etc.) require credentials
  // public_bucket=1 only works for truly public AWS S3 buckets
  if (!hasCredentials && config.endpoint) {
    throw new Error(
      `S3-compatible storage requires credentials. ` +
        `Detected endpoint: ${config.endpoint}. ` +
        `The public_bucket option only works for AWS S3 public buckets, not R2, MinIO, etc.`,
    );
  }

  if (hasCredentials) {
    // Write credentials file (remove old one first to avoid permission issues)
    // s3fs requires the file to have 600 permissions (no "others" access)
    const credentialsContent = `${config.accessKeyId}:${config.secretAccessKey}`;
    await runCommand(sandbox, `rm -f ${credentialsPath}`);
    await sandbox.fs.write(credentialsPath, credentialsContent);
    await runCommand(sandbox, `chmod 600 ${credentialsPath}`);
  }

  // Build mount options
  const mountOptions: string[] = [];

  if (hasCredentials) {
    mountOptions.push(`passwd_file=${credentialsPath}`);
  } else {
    // Public bucket mode - read-only access without credentials
    mountOptions.push('public_bucket=1');
    logger.debug(`${LOG_PREFIX} No credentials provided, mounting as public bucket (read-only)`);
  }

  mountOptions.push('allow_other'); // Allow non-root users to access the mount

  // Set uid/gid so mounted files are owned by user, not root
  if (uid && gid) {
    mountOptions.push(`uid=${uid}`, `gid=${gid}`);
  }

  if (config.endpoint) {
    // For S3-compatible storage (MinIO, R2, etc.)
    const endpoint = config.endpoint.replace(/\/$/, '');
    mountOptions.push(`url=${endpoint}`, 'use_path_request_style', 'sigv4', 'nomultipart');
  }

  if (config.readOnly) {
    mountOptions.push('ro');
    logger.debug(`${LOG_PREFIX} Mounting as read-only`);
  }

  const quotedMountPath = shellQuote(mountPath);
  const mountCmd = `s3fs ${config.bucket} ${quotedMountPath} -o ${mountOptions.join(' -o ')}`;
  logger.debug(`${LOG_PREFIX} Mounting S3:`, hasCredentials ? mountCmd.replace(credentialsPath, '***') : mountCmd);

  const result = await runCommand(sandbox, mountCmd, { timeout: 60_000 });
  logger.debug(`${LOG_PREFIX} s3fs result:`, {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  if (result.exitCode !== 0) {
    throw new Error(`Failed to mount S3 bucket: ${result.stderr || result.stdout}`);
  }
}
