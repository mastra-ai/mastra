/**
 * Filesystem Providers
 *
 * Available filesystem implementations for use with Workspace.
 */

export { LocalFilesystem, type LocalFilesystemOptions } from './local';
export { RamFilesystem, type RamFilesystemOptions } from './ram';

// Keep MemoryFilesystem as an alias for backwards compatibility
export { RamFilesystem as MemoryFilesystem, type RamFilesystemOptions as MemoryFilesystemOptions } from './ram';
