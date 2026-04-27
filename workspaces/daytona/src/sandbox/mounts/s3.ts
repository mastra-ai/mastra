import { createHash } from 'node:crypto';

import type { FilesystemMountConfig } from '@mastra/core/workspace';

import { shellQuote } from '../../utils/shell-quote';
import { LOG_PREFIX, validateBucketName, validateEndpoint, validatePrefix } from './types';
import type { MountContext } from './types';

/**
 * S3 mount config for Daytona (mounted via s3fs-fuse).
 *
 * If credentials are not provided, the bucket will be mounted as read-only
 * using the `public_bucket=1` option (for public AWS S3 buckets only).
 *
 * Note: S3-compatible services (R2, MinIO, etc.) always require credentials.
 */
export interface DaytonaS3MountConfig extends FilesystemMountConfig {
  type: 's3';
  /** S3 bucket name */
  bucket: string;
  /** AWS region */
  region: string;
  /** S3 endpoint for S3-compatible storage (MinIO, R2, etc.) */
  endpoint?: string;
  /** AWS access key ID (optional - omit for public buckets) */
  accessKeyId?: string;
  /** AWS secret access key (optional - omit for public buckets) */
  secretAccessKey?: string;
  /**
   * Optional prefix (subdirectory) to mount instead of the entire bucket.
   * Uses s3fs `bucket:/prefix` syntax. Leading/trailing slashes are normalized.
   */
  prefix?: string;
  /** Mount as read-only (even if credentials have write access) */
  readOnly?: boolean;
}

/**
 * Mount an S3 bucket using s3fs-fuse.
 */
export async function mountS3(mountPath: string, config: DaytonaS3MountConfig, ctx: MountContext): Promise<void> {
  const { run, writeFile, logger } = ctx;

  validateBucketName(config.bucket);
  if (config.endpoint) {
    validateEndpoint(config.endpoint);
  }

  const quotedMountPath = shellQuote(mountPath);

  // Validate credentials before any network calls — this gives the user a clear,
  // immediate error instead of a confusing connectivity failure.
  const hasAccessKey = !!config.accessKeyId;
  const hasSecretKey = !!config.secretAccessKey;
  if (hasAccessKey !== hasSecretKey) {
    throw new Error('Both accessKeyId and secretAccessKey must be provided together.');
  }
  const hasCredentials = hasAccessKey && hasSecretKey;

  if (!hasCredentials && config.endpoint) {
    throw new Error(
      `S3-compatible storage requires credentials. ` +
        `Detected endpoint: ${config.endpoint}. ` +
        `The public_bucket option only works for AWS S3 public buckets, not R2, MinIO, etc.`,
    );
  }

  // For S3-compatible storage (R2, MinIO, etc.), check connectivity to the custom endpoint.
  // AWS S3 endpoints are whitelisted in Daytona's proxy so no check needed for the default case.
  if (config.endpoint) {
    const endpoint = config.endpoint.replace(/\/$/, '');
    const connectivityCheck = await run(`curl -sS --max-time 5 ${shellQuote(endpoint)} 2>&1`, 10_000);
    const checkOutput = connectivityCheck.stdout.trim();
    if (
      connectivityCheck.exitCode !== 0 ||
      checkOutput.toLowerCase().includes('restricted') ||
      checkOutput.toLowerCase().includes('blocked')
    ) {
      throw new Error(
        `Cannot reach ${endpoint} from this sandbox. ` +
          `S3-compatible storage mounting requires network access to the configured endpoint, ` +
          `which may be blocked on Daytona's restricted tiers. ` +
          `Upgrade to a tier with unrestricted internet access, or contact Daytona support to remove the network restriction.` +
          (checkOutput ? `\n\nSandbox network response: ${checkOutput}` : ''),
      );
    }
  }

  // Install s3fs if not present
  const checkResult = await run('which s3fs 2>/dev/null || echo "not found"', 30_000);
  if (checkResult.stdout.includes('not found')) {
    logger.warn(`${LOG_PREFIX} s3fs not found, attempting runtime installation...`);
    logger.info(`${LOG_PREFIX} Tip: For faster startup, pre-install s3fs in your sandbox image`);

    await run('sudo apt-get update -qq 2>&1', 60_000);

    // The fuse package's post-install script may fail in containers (e.g. can't run modprobe,
    // can't set SUID). Use || true so the overall command succeeds even if dpkg exits non-zero,
    // then verify the binary is actually present below.
    await run('sudo apt-get install -y s3fs fuse 2>&1 || sudo apt-get install -y s3fs-fuse fuse 2>&1 || true', 120_000);

    // Verify installation
    const s3fsCheck = await run('which s3fs 2>/dev/null || echo "not found"', 30_000);
    if (s3fsCheck.stdout.includes('not found')) {
      throw new Error('Failed to install s3fs: binary not found after install attempt');
    }
  }

  // The fuse post-install script may fail to set the SUID bit on fusermount.
  // Set it explicitly so non-root processes can call fusermount.
  await run('sudo chmod u+s /usr/bin/fusermount3 /usr/bin/fusermount 2>/dev/null || true', 30_000);

  // Get uid/gid for proper file ownership
  const idResult = await run('id -u && id -g', 30_000);
  const [uid, gid] = idResult.stdout.trim().split('\n');
  const validUidGid = uid && gid && /^\d+$/.test(uid) && /^\d+$/.test(gid);
  if (!validUidGid) {
    logger.warn(
      `${LOG_PREFIX} Unexpected uid/gid format: "${idResult.stdout.trim()}" — mounted files will be owned by root`,
    );
  }

  // Use a mount-specific credentials path to avoid races with concurrent mounts
  const mountHash = createHash('md5').update(mountPath).digest('hex').slice(0, 8);
  const credentialsPath = `/tmp/.passwd-s3fs-${mountHash}`;

  // Allow non-root processes to use FUSE and the allow_other mount option.
  // These are no-ops if already configured.
  await run(
    `sudo chmod a+rw /dev/fuse 2>/dev/null || true; ` +
      `sudo bash -c 'grep -q "^user_allow_other" /etc/fuse.conf 2>/dev/null || echo "user_allow_other" >> /etc/fuse.conf' 2>/dev/null || true`,
  );

  if (hasCredentials) {
    await run(`sudo rm -f ${shellQuote(credentialsPath)}`, 30_000);
    await writeFile(credentialsPath, `${config.accessKeyId}:${config.secretAccessKey}`);
    await run(`chmod 600 ${shellQuote(credentialsPath)}`, 30_000);
  }

  const mountOptions: string[] = [];

  if (hasCredentials) {
    mountOptions.push(`passwd_file=${credentialsPath}`);
  } else {
    mountOptions.push('public_bucket=1');
    logger.debug(`${LOG_PREFIX} No credentials provided, mounting as public bucket (read-only)`);
  }

  // allow_other: let other users (e.g. root for rmdir) access the mount.
  // Requires user_allow_other in /etc/fuse.conf for non-root mounts.
  mountOptions.push('allow_other');

  if (validUidGid) {
    mountOptions.push(`uid=${uid}`, `gid=${gid}`);
  }

  if (config.endpoint) {
    const endpoint = config.endpoint.replace(/\/$/, '');
    mountOptions.push(`url=${shellQuote(endpoint)}`, 'use_path_request_style', 'sigv4', 'nomultipart');
  }

  if (config.readOnly) {
    mountOptions.push('ro');
    logger.debug(`${LOG_PREFIX} Mounting as read-only`);
  }

  // Build the s3fs bucket argument — supports optional prefix via `bucket:/path` syntax
  let bucketArg = config.bucket;
  if (config.prefix) {
    const normalizedPrefix = validatePrefix(config.prefix);
    bucketArg = `${config.bucket}:/${normalizedPrefix}`;
  }

  // Run s3fs as the sandbox user (not root) so the FUSE connection is registered
  // in the container's user namespace — allowing fusermount -u to unmount it later.
  const mountCmd = `s3fs ${shellQuote(bucketArg)} ${quotedMountPath} -o ${mountOptions.join(' -o ')}`;
  logger.debug(`${LOG_PREFIX} Mounting S3:`, hasCredentials ? mountCmd.replace(credentialsPath, '***') : mountCmd);

  const result = await run(mountCmd, 60_000);
  logger.debug(`${LOG_PREFIX} s3fs result:`, {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  if (result.exitCode !== 0) {
    throw new Error(`Failed to mount S3 bucket: ${result.stderr || result.stdout}`);
  }
}
