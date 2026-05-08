import type { FilesystemMountConfig } from '@mastra/core/workspace';

import { shellQuote } from '../../utils/shell-quote';
import { LOG_PREFIX, validateBucketName, validateEndpoint, validatePrefix, validateRegion } from './types';
import type { MountContext } from './types';

/**
 * S3 mount config for E2B (mounted via s3fs-fuse).
 *
 * If credentials are not provided, the bucket will be mounted as read-only
 * using the `public_bucket=1` option (for public AWS S3 buckets only).
 *
 * Note: S3-compatible services (R2, MinIO, etc.) always require credentials.
 */
export interface E2BS3MountConfig extends FilesystemMountConfig {
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
export async function mountS3(mountPath: string, config: E2BS3MountConfig, ctx: MountContext): Promise<void> {
  const { sandbox, logger } = ctx;

  // Validate inputs before interpolating into shell commands
  validateBucketName(config.bucket);
  validateRegion(config.region);
  if (config.endpoint) {
    validateEndpoint(config.endpoint);
  }

  // Check if s3fs is installed
  const checkResult = await sandbox.commands.run('which s3fs || echo "not found"');
  if (checkResult.stdout.includes('not found')) {
    logger.warn(`${LOG_PREFIX} s3fs not found, attempting runtime installation...`);
    logger.info(
      `${LOG_PREFIX} Tip: For faster startup, use createMountableTemplate() to pre-install s3fs in your sandbox template`,
    );

    await sandbox.commands.run('sudo apt-get update 2>&1', { timeoutMs: 60000 });

    const installResult = await sandbox.commands.run(
      'sudo apt-get install -y s3fs fuse 2>&1 || sudo apt-get install -y s3fs-fuse fuse 2>&1',
      { timeoutMs: 120000 },
    );

    if (installResult.exitCode !== 0) {
      throw new Error(
        `Failed to install s3fs. ` +
          `For S3 mounting, your template needs s3fs and fuse packages.\n\n` +
          `Option 1: Use createMountableTemplate() helper:\n` +
          `  import { E2BSandbox, createMountableTemplate } from '@mastra/e2b';\n` +
          `  const sandbox = new E2BSandbox({ template: createMountableTemplate() });\n\n` +
          `Option 2: Customize the base template:\n` +
          `  new E2BSandbox({ template: base => base.aptInstall(['your-packages']) })\n\n` +
          `Error details: ${installResult.stderr || installResult.stdout}`,
      );
    }
  }

  // Get user's uid/gid for proper file ownership
  const idResult = await sandbox.commands.run('id -u && id -g');
  const [uid, gid] = idResult.stdout.trim().split('\n');

  // Determine if we have credentials or using public bucket mode
  const hasCredentials = config.accessKeyId && config.secretAccessKey;
  const credentialsPath = '/tmp/.passwd-s3fs';

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
    const credentialsContent = `${config.accessKeyId}:${config.secretAccessKey}`;
    await sandbox.commands.run(`sudo rm -f ${credentialsPath}`);
    await sandbox.files.write(credentialsPath, credentialsContent);
    await sandbox.commands.run(`chmod 600 ${credentialsPath}`);
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

  // s3fs's `endpoint` option sets the AWS region used for sigv4 signing
  // (confusingly named — distinct from the URL `endpoint` flag above).
  // Default is us-east-1, which produces SignatureDoesNotMatch errors against
  // buckets in other regions or S3-compatible services that validate the region.
  mountOptions.push(`endpoint=${config.region}`);

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

  // Mount with sudo (required for /dev/fuse access)
  const mountCmd = `sudo s3fs ${shellQuote(bucketArg)} ${shellQuote(mountPath)} -o ${mountOptions.join(' -o ')}`;
  logger.debug(`${LOG_PREFIX} Mounting S3:`, hasCredentials ? mountCmd.replace(credentialsPath, '***') : mountCmd);

  try {
    const result = await sandbox.commands.run(mountCmd, { timeoutMs: 60_000 });
    logger.debug(`${LOG_PREFIX} s3fs result:`, {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    });
    if (result.exitCode !== 0) {
      throw new Error(`Failed to mount S3 bucket: ${result.stderr || result.stdout}`);
    }
  } catch (error: unknown) {
    const errorObj = error as { result?: { exitCode: number; stdout: string; stderr: string } };
    const stderr = errorObj.result?.stderr || '';
    const stdout = errorObj.result?.stdout || '';
    logger.error(`${LOG_PREFIX} s3fs error:`, { stderr, stdout, error: String(error) });
    throw new Error(`Failed to mount S3 bucket: ${stderr || stdout || error}`);
  }

  // s3fs daemonizes before running its FUSE init, where the bucket check happens.
  // If that check fails (wrong region, bad credentials, unsupported endpoint),
  // the daemon exits but the parent has already returned exit code 0.
  // Verify the mount actually attached.
  const verify = await sandbox.commands.run(`mountpoint -q ${shellQuote(mountPath)}`);
  if (verify.exitCode !== 0) {
    throw new Error(
      `s3fs returned exit 0 but ${mountPath} is not a mountpoint. ` +
        `The s3fs daemon likely failed during FUSE init (common causes: region mismatch, ` +
        `invalid credentials, or an S3-compatible endpoint that rejects the signature). ` +
        `Re-run inside the sandbox with '-f -o dbglevel=info' to see the underlying error.`,
    );
  }
}
