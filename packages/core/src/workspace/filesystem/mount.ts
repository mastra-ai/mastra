/**
 * Mount Types for Workspace Filesystems
 *
 * These types define the configuration needed to mount cloud filesystems
 * into sandbox environments (e.g., E2B) via FUSE tools like s3fs and gcsfuse.
 */

// =============================================================================
// Base Mount Configuration
// =============================================================================

/**
 * Base configuration for filesystem mounts.
 * Extended by specific mount types (S3, GCS, R2).
 */
export interface FilesystemMountConfig {
  /** Mount type identifier */
  type: string;
}

// =============================================================================
// Cloud Storage Mount Configurations
// =============================================================================

/**
 * S3 mount configuration.
 * Used when mounting S3 or S3-compatible storage into sandboxes via s3fs-fuse.
 */
export interface S3MountConfig extends FilesystemMountConfig {
  type: 's3';
  /** S3 bucket name */
  bucket: string;
  /** AWS region (use 'auto' for R2) */
  region?: string;
  /** Optional endpoint for S3-compatible storage (MinIO, R2, etc.) */
  endpoint?: string;
  /** Optional prefix for all keys (acts like a subdirectory) */
  prefix?: string;
  /** AWS access key ID */
  accessKeyId?: string;
  /** AWS secret access key */
  secretAccessKey?: string;
}

/**
 * GCS mount configuration.
 * Used when mounting Google Cloud Storage into sandboxes via gcsfuse.
 */
export interface GCSMountConfig extends FilesystemMountConfig {
  type: 'gcs';
  /** GCS bucket name */
  bucket: string;
  /** Service account key JSON (stringified) */
  serviceAccountKey?: string;
}

/**
 * Cloudflare R2 mount configuration.
 * R2 is S3-compatible, mounted via s3fs-fuse with R2-specific endpoint.
 */
export interface R2MountConfig extends FilesystemMountConfig {
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
 * Union type of all supported mount configurations.
 */
export type MountConfig = S3MountConfig | GCSMountConfig | R2MountConfig;

// =============================================================================
// Mount Result
// =============================================================================

/**
 * Result of a mount operation.
 */
export interface MountResult {
  /** Whether the mount was successful */
  success: boolean;
  /** Path where the filesystem was mounted */
  mountPath: string;
  /** Error message if mount failed */
  error?: string;
}

// =============================================================================
// Icon Types
// =============================================================================

/**
 * Icon identifiers for filesystem providers.
 * Used in UI to display appropriate icons.
 */
export type FilesystemIcon =
  | 's3'
  | 'aws-s3'
  | 'gcs'
  | 'google-cloud'
  | 'google-cloud-storage'
  | 'r2'
  | 'cloudflare'
  | 'cloudflare-r2'
  | 'azure'
  | 'azure-blob'
  | 'minio'
  | 'local'
  | 'folder'
  | 'database'
  | 'hard-drive'
  | 'cloud'
  | string;
