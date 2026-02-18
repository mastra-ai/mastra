/**
 * Shared filesystem utilities for LocalFilesystem and LocalSkillSource.
 *
 * These utilities provide consistent implementations for common fs operations.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { FileNotFoundError } from '../errors';

// =============================================================================
// Types
// =============================================================================

/**
 * Full file stat information.
 * Used by both WorkspaceFilesystem and SkillSource.
 */
export interface FsStatResult {
  /** File or directory name */
  name: string;
  /** 'file' or 'directory' */
  type: 'file' | 'directory';
  /** Size in bytes (0 for directories) */
  size: number;
  /** Creation time */
  createdAt: Date;
  /** Last modification time */
  modifiedAt: Date;
  /** MIME type (for files) */
  mimeType?: string;
}

// =============================================================================
// Error Utilities
// =============================================================================

/**
 * Check if an error is an ENOENT (file not found) error.
 */
export function isEnoentError(error: unknown): error is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return (
    error !== null && typeof error === 'object' && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

/**
 * Check if an error is an EEXIST (file exists) error.
 */
export function isEexistError(error: unknown): error is NodeJS.ErrnoException & { code: 'EEXIST' } {
  return (
    error !== null && typeof error === 'object' && 'code' in error && (error as NodeJS.ErrnoException).code === 'EEXIST'
  );
}

// =============================================================================
// MIME Type Detection
// =============================================================================

const MIME_TYPES: Record<string, string> = {
  // Text
  txt: 'text/plain',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  csv: 'text/csv',
  md: 'text/markdown',
  // Code
  js: 'application/javascript',
  mjs: 'application/javascript',
  ts: 'application/typescript',
  tsx: 'application/typescript',
  jsx: 'application/javascript',
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'text/yaml',
  yml: 'text/yaml',
  // Programming languages
  py: 'text/x-python',
  rb: 'text/x-ruby',
  go: 'text/x-go',
  rs: 'text/x-rust',
  java: 'text/x-java',
  c: 'text/x-c',
  cpp: 'text/x-c++',
  h: 'text/x-c',
  hpp: 'text/x-c++',
  sh: 'text/x-sh',
  bash: 'text/x-sh',
  zsh: 'text/x-sh',
  // Config
  toml: 'text/toml',
  ini: 'text/plain',
  env: 'text/plain',
  // Database/Query
  sql: 'text/x-sql',
  graphql: 'application/graphql',
  gql: 'application/graphql',
  // Frameworks
  vue: 'text/x-vue',
  // Images
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  ico: 'image/x-icon',
  // Documents
  pdf: 'application/pdf',
};

/**
 * Get MIME type for a filename based on extension.
 */
export function getMimeType(filename: string): string {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * Extensions that should be treated as text files.
 */
const TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.js',
  '.mjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.sh',
  '.bash',
  '.zsh',
  '.html',
  '.htm',
  '.css',
  '.xml',
  '.toml',
  '.ini',
  '.env',
  '.csv',
  '.sql',
  '.graphql',
  '.gql',
  '.vue',
  '.svg',
]);

/**
 * Check if a file should be treated as text based on extension.
 */
export function isTextFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

// =============================================================================
// Path Resolution
// =============================================================================

/**
 * Resolve a workspace path to an absolute OS filesystem path.
 *
 * Workspace paths typically start with '/' but are relative to `basePath`
 * (e.g. "/app.ts" → "basePath/app.ts"). However, with `contained: false` or
 * when the path is already a real path within `basePath`, it should be used as-is.
 *
 * @param basePath - The workspace filesystem base path
 * @param filePath - The workspace path to resolve
 * @returns The absolute OS filesystem path
 */
export function resolveWorkspacePath(basePath: string, filePath: string): string {
  if (path.isAbsolute(filePath)) {
    const normalizedBase = path.normalize(basePath);
    const normalizedFile = path.normalize(filePath);
    const rel = path.relative(normalizedBase, normalizedFile);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      return normalizedFile;
    }
  }
  return path.join(basePath, filePath.replace(/^\/+/, ''));
}

// =============================================================================
// Filesystem Operations
// =============================================================================

/**
 * Check if a path exists.
 * Never throws - returns false on any error.
 *
 * @param absolutePath - The absolute path to check
 * @returns true if path exists and is accessible
 */
export async function fsExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file/directory stats.
 * Throws FileNotFoundError if path doesn't exist.
 *
 * @param absolutePath - The absolute path to stat
 * @param userPath - The user-facing path for error messages
 * @returns File stat information
 * @throws {FileNotFoundError} if path doesn't exist
 */
export async function fsStat(absolutePath: string, userPath: string): Promise<FsStatResult> {
  try {
    const stats = await fs.stat(absolutePath);
    return {
      name: path.basename(absolutePath),
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      mimeType: stats.isFile() ? getMimeType(absolutePath) : undefined,
    };
  } catch (error: unknown) {
    if (isEnoentError(error)) {
      throw new FileNotFoundError(userPath);
    }
    throw error;
  }
}
