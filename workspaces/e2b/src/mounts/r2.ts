import type { FilesystemMountConfig } from '@mastra/core/workspace';
import { mountS3 } from './s3';
import type { E2BS3MountConfig } from './s3';
import type { MountContext } from './types';

/**
 * R2 mount config for E2B (mounted via s3fs-fuse).
 *
 * R2 is S3-compatible with a specific endpoint format.
 * Credentials are always required (R2 doesn't support anonymous access).
 */
export interface E2BR2MountConfig extends FilesystemMountConfig {
  type: 'r2';
  /** R2 account ID */
  accountId: string;
  /** R2 bucket name */
  bucket: string;
  /** R2 access key ID */
  accessKeyId: string;
  /** R2 secret access key */
  secretAccessKey: string;
}

/**
 * Mount an R2 bucket using s3fs-fuse.
 *
 * Converts R2 config to S3 config and delegates to mountS3.
 */
export async function mountR2(mountPath: string, config: E2BR2MountConfig, ctx: MountContext): Promise<void> {
  // R2 is S3-compatible, use s3fs with R2 endpoint
  const s3Config: E2BS3MountConfig = {
    type: 's3',
    bucket: config.bucket,
    region: 'auto',
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
  };

  await mountS3(mountPath, s3Config, ctx);
}
