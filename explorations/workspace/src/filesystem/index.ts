/**
 * Filesystem Module
 *
 * Re-exports filesystem providers and types.
 */

// Providers
export { LocalFilesystem, type LocalFilesystemOptions } from './providers/local';
export { RamFilesystem, type RamFilesystemOptions } from './providers/ram';

// Keep MemoryFilesystem as alias for backwards compatibility
export { RamFilesystem as MemoryFilesystem, type RamFilesystemOptions as MemoryFilesystemOptions } from './providers/ram';

// Types and errors
export type {
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
} from '../types';

export {
  FilesystemError,
  FileNotFoundError,
  DirectoryNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
  PermissionError,
} from '../types';
