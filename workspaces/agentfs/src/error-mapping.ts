/**
 * Error mapping from AgentFS errno-style errors to Mastra workspace errors.
 */

import {
  FileNotFoundError,
  DirectoryNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
  PermissionError,
} from '@mastra/core/workspace';

interface ErrnoError {
  code?: string;
  message?: string;
}

function isErrnoError(error: unknown): error is ErrnoError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

/**
 * Map an AgentFS errno error to a Mastra filesystem error.
 *
 * @param error - The error thrown by AgentFS
 * @param path - The path involved in the operation
 * @param context - Whether the operation targets a file or directory
 * @returns The mapped Mastra error, or the original error if not mappable
 */
export function mapError(error: unknown, path: string, context: 'file' | 'directory' = 'file'): Error {
  if (!isErrnoError(error)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  switch (error.code) {
    case 'ENOENT':
      return context === 'directory' ? new DirectoryNotFoundError(path) : new FileNotFoundError(path);
    case 'EEXIST':
      return new FileExistsError(path);
    case 'EISDIR':
      return new IsDirectoryError(path);
    case 'ENOTDIR':
      return new NotDirectoryError(path);
    case 'ENOTEMPTY':
      return new DirectoryNotEmptyError(path);
    case 'EPERM':
    case 'EACCES':
      return new PermissionError(path, 'access');
    default:
      return error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Check if an error has a specific errno code.
 */
export function hasCode(error: unknown, code: string): boolean {
  return isErrnoError(error) && error.code === code;
}
