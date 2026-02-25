import type { FilesystemMountConfig } from '@mastra/core/workspace';

import { LOG_PREFIX } from '../index';
import { validateBucketName, validateEndpoint } from './types';
import type { MountContext } from './types';

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
  /** Mount as read-only */
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

  // Install s3fs if not present
  const checkResult = await run('which s3fs || echo "not found"');
  if (checkResult.stdout.includes('not found')) {
    logger.warn(`${LOG_PREFIX} s3fs not found, installing...`);

    await run('sudo apt-get update 2>&1', 60_000);

    const installResult = await run(
      'sudo apt-get install -y s3fs fuse 2>&1 || sudo apt-get install -y s3fs-fuse fuse 2>&1',
      120_000,
    );

    if (installResult.exitCode !== 0) {
      throw new Error(`Failed to install s3fs: ${installResult.stderr || installResult.stdout}`);
    }
  }

  // Get uid/gid for proper file ownership
  const idResult = await run('id -u && id -g');
  const [uid, gid] = idResult.stdout.trim().split('\n');

  const hasCredentials = config.accessKeyId && config.secretAccessKey;
  const credentialsPath = '/tmp/.passwd-s3fs';

  if (!hasCredentials && config.endpoint) {
    throw new Error(
      `S3-compatible storage requires credentials. ` +
        `Detected endpoint: ${config.endpoint}. ` +
        `The public_bucket option only works for AWS S3 public buckets, not R2, MinIO, etc.`,
    );
  }

  if (hasCredentials) {
    await run(`sudo rm -f ${credentialsPath}`);
    await writeFile(credentialsPath, `${config.accessKeyId}:${config.secretAccessKey}`);
    await run(`chmod 600 ${credentialsPath}`);
  }

  const mountOptions: string[] = [];

  if (hasCredentials) {
    mountOptions.push(`passwd_file=${credentialsPath}`);
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

  const mountCmd = `sudo s3fs ${config.bucket} ${mountPath} -o ${mountOptions.join(' -o ')}`;
  logger.debug(`${LOG_PREFIX} Mounting S3: ${hasCredentials ? mountCmd.replace(credentialsPath, '***') : mountCmd}`);

  try {
    const result = await run(mountCmd, 60_000);
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
}
