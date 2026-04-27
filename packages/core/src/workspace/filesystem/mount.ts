/**
 * Mount Types for Workspace Filesystems
 *
 * Base types for filesystem mounts. Provider-specific mount configs
 * are defined in their respective packages (e.g., @mastra/s3, @mastra/e2b).
 */

// =============================================================================
// Base Mount Configuration
// =============================================================================

/**
 * Base configuration for filesystem mounts.
 * Extended by specific packages (e.g., @mastra/s3 defines S3MountConfig).
 *
 * Filesystem packages implement getMountConfig() returning their specific config.
 * Sandbox packages define what mount configs they support.
 */
export interface FilesystemMountConfig {
  /** Mount type identifier (e.g., 's3', 'gcs', 'r2') */
  type: string;
}

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
  /** True when mount failed because a required tool is not installed (not a real error) */
  unavailable?: boolean;
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
