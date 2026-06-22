/**
 * @mastra/archil - Archil Filesystem Provider for Mastra Workspaces
 *
 * Elastic, serverless filesystems for AI agents backed by Archil.
 * Supports creating disks, reading/writing files, running commands, and searching.
 */

export { ArchilFilesystem, type ArchilFilesystemOptions } from './filesystem';
export { archilFilesystemProvider } from './provider';

// Re-export useful Archil SDK types for consumers
export type {
  ExecResult,
  GrepOptions,
  GrepResult,
  GrepMatch,
  GrepStoppedReason,
  CreateDiskRequest,
  CreateDiskResult,
  ListObjectsOptions,
  ListObjectsResult,
  S3Object,
  ObjectMetadata,
  ShareUrlOptions,
  ShareUrlResult,
} from 'disk';
