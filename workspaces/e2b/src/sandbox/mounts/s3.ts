import type { FilesystemMountConfig } from '@mastra/core/workspace';

import { LOG_PREFIX, validateBucketName, validateEndpoint, validatePrefix } from './types';
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
  /** AWS session token for temporary credentials (STS/AssumeRole/Federation) */
  sessionToken?: string;
  /** Mount as read-only (even if credentials have write access) */
  readOnly?: boolean;
  /**
   * S3 key prefix to scope the mount.
   * When set, s3fs uses `bucket:/prefix` syntax to mount only the prefix
   * subdirectory, so sandbox paths map directly to prefixed S3 keys.
   * Without trailing slash (e.g., 'workspace/user1/agents/abc').
   */
  prefix?: string;
}

/**
 * Mount an S3 bucket using s3fs-fuse.
 *
 * When `config.prefix` is set, s3fs uses `bucket:/prefix` syntax to mount only
 * the prefix subdirectory directly to `mountPath`. This ensures that file operations
 * within the sandbox at `mountPath` map directly to the prefixed S3 keys, aligning
 * FUSE paths with the S3Filesystem API.
 */
export async function mountS3(mountPath: string, config: E2BS3MountConfig, ctx: MountContext): Promise<void> {
  const { sandbox, logger } = ctx;

  // Validate inputs before interpolating into shell commands
  validateBucketName(config.bucket);
  if (config.endpoint) {
    validateEndpoint(config.endpoint);
  }
  if (config.prefix) {
    validatePrefix(config.prefix);
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
  const passwdPath = '/tmp/.passwd-s3fs';
  // s3fs reads AWS credentials from ~/.aws/credentials when run with sudo, ~ = /root
  const awsCredentialsDir = '/root/.aws';
  const awsCredentialsPath = `${awsCredentialsDir}/credentials`;

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
    if (config.sessionToken) {
      // STS temporary credentials: must use standard AWS credentials file (INI format).
      // The s3fs passwd file only supports "key:secret" — no session token support.
      // s3fs automatically reads ~/.aws/credentials; with sudo, ~ resolves to /root.
      // The -o use_session_token flag tells s3fs to look for aws_session_token in the file.
      const awsCredsContent = [
        '[default]',
        `aws_access_key_id=${config.accessKeyId}`,
        `aws_secret_access_key=${config.secretAccessKey}`,
        `aws_session_token=${config.sessionToken}`,
      ].join('\n');
      // Write to temp file first (user-writable), then sudo mv to /root/.aws/
      // This avoids shell-escaping issues with session tokens containing special chars
      const tmpCredsPath = '/tmp/.aws-creds-staging';
      await sandbox.files.write(tmpCredsPath, awsCredsContent);
      await sandbox.commands.run(
        `sudo mkdir -p ${awsCredentialsDir} && sudo mv ${tmpCredsPath} ${awsCredentialsPath} && sudo chmod 600 ${awsCredentialsPath}`,
      );
    } else {
      // Long-lived IAM credentials: use simple passwd file (key:secret)
      await sandbox.commands.run(`sudo rm -f ${passwdPath}`);
      await sandbox.files.write(passwdPath, `${config.accessKeyId}:${config.secretAccessKey}`);
      await sandbox.commands.run(`chmod 600 ${passwdPath}`);
    }
  }

  // Build mount options
  const mountOptions: string[] = [];

  if (hasCredentials) {
    if (config.sessionToken) {
      // s3fs reads /root/.aws/credentials automatically when run as root (via sudo)
      mountOptions.push('use_session_token');
    } else {
      mountOptions.push(`passwd_file=${passwdPath}`);
    }
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

  // Build the s3fs bucket source:
  // - Without prefix: just the bucket name (existing behavior)
  // - With prefix: use `bucket:/prefix` syntax to mount only the subdirectory
  const bucketSource = config.prefix ? `${config.bucket}:/${config.prefix}` : config.bucket;

  // Mount with sudo (required for /dev/fuse access)
  const mountCmd = `sudo s3fs ${bucketSource} ${mountPath} -o ${mountOptions.join(' -o ')}`;
  // Redact credential file paths from logs
  const logCmd = mountCmd.replace(passwdPath, '***');
  logger.debug(`${LOG_PREFIX} Mounting S3:`, hasCredentials ? logCmd : mountCmd);

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

  if (config.prefix) {
    logger.debug(`${LOG_PREFIX} S3 prefix mount successful: sandbox "${mountPath}" → S3 "${config.prefix}/"`);
  }
}
