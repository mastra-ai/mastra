/**
 * Base Filesystem Implementation
 *
 * Abstract base class providing shared logic for filesystem implementations.
 * Concrete providers extend this class.
 */

import type {
  WorkspaceFilesystem,
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
  WatchCallback,
  WatchOptions,
  WatchHandle,
} from './types';

/**
 * Abstract base class for filesystem implementations.
 *
 * Providers must implement the abstract methods.
 * Common utilities are provided by this base class.
 */
export abstract class BaseFilesystem implements WorkspaceFilesystem {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly provider: string;

  // ---------------------------------------------------------------------------
  // Abstract methods - must be implemented by providers
  // ---------------------------------------------------------------------------

  abstract readFile(path: string, options?: ReadOptions): Promise<string | Buffer>;
  abstract writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void>;
  abstract appendFile(path: string, content: FileContent): Promise<void>;
  abstract deleteFile(path: string, options?: RemoveOptions): Promise<void>;
  abstract copyFile(src: string, dest: string, options?: CopyOptions): Promise<void>;
  abstract moveFile(src: string, dest: string, options?: CopyOptions): Promise<void>;

  abstract mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  abstract rmdir(path: string, options?: RemoveOptions): Promise<void>;
  abstract readdir(path: string, options?: ListOptions): Promise<FileEntry[]>;

  abstract exists(path: string): Promise<boolean>;
  abstract stat(path: string): Promise<FileStat>;
  abstract isFile(path: string): Promise<boolean>;
  abstract isDirectory(path: string): Promise<boolean>;

  // ---------------------------------------------------------------------------
  // Optional methods with default implementations
  // ---------------------------------------------------------------------------

  /**
   * Watch for changes. Default implementation returns undefined (not supported).
   * Providers that support watching should override this.
   */
  async watch?(
    _path: string,
    _callback: WatchCallback,
    _options?: WatchOptions,
  ): Promise<WatchHandle | undefined> {
    return undefined;
  }

  /**
   * Initialize the filesystem. Default is a no-op.
   */
  async init(): Promise<void> {
    // Default: no initialization needed
  }

  /**
   * Clean up resources. Default is a no-op.
   */
  async destroy(): Promise<void> {
    // Default: no cleanup needed
  }

  // ---------------------------------------------------------------------------
  // Utility methods available to subclasses
  // ---------------------------------------------------------------------------

  /**
   * Get MIME type from file extension.
   */
  protected getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const mimeTypes: Record<string, string> = {
      txt: 'text/plain',
      md: 'text/markdown',
      json: 'application/json',
      js: 'application/javascript',
      mjs: 'application/javascript',
      cjs: 'application/javascript',
      ts: 'application/typescript',
      tsx: 'application/typescript',
      jsx: 'application/javascript',
      py: 'text/x-python',
      rb: 'text/x-ruby',
      rs: 'text/x-rust',
      go: 'text/x-go',
      html: 'text/html',
      css: 'text/css',
      xml: 'application/xml',
      yaml: 'application/x-yaml',
      yml: 'application/x-yaml',
      toml: 'application/toml',
      sh: 'application/x-sh',
      bash: 'application/x-sh',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      pdf: 'application/pdf',
      zip: 'application/zip',
      tar: 'application/x-tar',
      gz: 'application/gzip',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Normalize path to consistent format.
   */
  protected normalizePath(inputPath: string): string {
    // Replace backslashes with forward slashes
    let normalized = inputPath.replace(/\\/g, '/');
    // Remove duplicate slashes
    normalized = normalized.replace(/\/+/g, '/');
    // Ensure leading slash
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    // Remove trailing slash (except for root)
    if (normalized !== '/' && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  /**
   * Parse path into segments.
   */
  protected parsePath(inputPath: string): string[] {
    const normalized = this.normalizePath(inputPath);
    return normalized.split('/').filter((p) => p && p !== '.');
  }

  /**
   * Convert content to Buffer.
   */
  protected toBuffer(content: FileContent): Buffer {
    if (Buffer.isBuffer(content)) {
      return content;
    }
    if (content instanceof Uint8Array) {
      return Buffer.from(content);
    }
    return Buffer.from(content, 'utf-8');
  }
}
