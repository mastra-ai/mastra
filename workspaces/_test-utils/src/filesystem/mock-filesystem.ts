/**
 * Mock filesystem for unit tests.
 *
 * An in-memory filesystem implementation for fast unit testing.
 */

import type {
  WorkspaceFilesystem,
  FileContent,
  FileEntry,
  FileStat,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
  ProviderStatus,
  FilesystemIcon,
} from '@mastra/core/workspace';
import { FileNotFoundError, PermissionError } from '@mastra/core/workspace';

export interface MockFilesystemOptions {
  /** Unique identifier */
  id?: string;
  /** Make filesystem read-only */
  readOnly?: boolean;
  /** Initial files to populate */
  initialFiles?: Record<string, string | Buffer>;
}

interface FileNode {
  type: 'file';
  content: Buffer;
  createdAt: Date;
  modifiedAt: Date;
}

interface DirNode {
  type: 'directory';
  createdAt: Date;
  modifiedAt: Date;
}

type FsNode = FileNode | DirNode;

/**
 * In-memory filesystem for testing.
 */
export class MockFilesystem implements WorkspaceFilesystem {
  readonly id: string;
  readonly name = 'MockFilesystem';
  readonly provider = 'mock';
  readonly readOnly?: boolean;
  readonly displayName = 'Mock Filesystem';
  readonly icon: FilesystemIcon = 'folder';
  readonly description = 'In-memory filesystem for testing';

  status: ProviderStatus = 'pending';

  private nodes: Map<string, FsNode> = new Map();

  constructor(options: MockFilesystemOptions = {}) {
    this.id = options.id ?? `mock-fs-${Date.now().toString(36)}`;
    this.readOnly = options.readOnly;

    // Initialize with root directory
    this.nodes.set('/', { type: 'directory', createdAt: new Date(), modifiedAt: new Date() });

    // Add initial files if provided
    if (options.initialFiles) {
      for (const [path, content] of Object.entries(options.initialFiles)) {
        const normalizedPath = this.normalizePath(path);
        this.ensureParentDirs(normalizedPath);
        this.nodes.set(normalizedPath, {
          type: 'file',
          content: typeof content === 'string' ? Buffer.from(content, 'utf-8') : content,
          createdAt: new Date(),
          modifiedAt: new Date(),
        });
      }
    }
  }

  private normalizePath(path: string): string {
    let normalized = path.startsWith('/') ? path : `/${path}`;
    normalized = normalized.replace(/\/+/g, '/');
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  private getParentPath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    if (parts.length <= 1) return '/';
    return '/' + parts.slice(0, -1).join('/');
  }

  private ensureParentDirs(path: string): void {
    const parts = path.split('/').filter(Boolean);
    let current = '';
    for (let i = 0; i < parts.length - 1; i++) {
      current += '/' + parts[i];
      if (!this.nodes.has(current)) {
        this.nodes.set(current, { type: 'directory', createdAt: new Date(), modifiedAt: new Date() });
      }
    }
  }

  private assertWritable(path: string, operation: string): void {
    if (this.readOnly) {
      throw new PermissionError(path, `${operation} (filesystem is read-only)`);
    }
  }

  async init(): Promise<void> {
    this.status = 'initializing';
    this.status = 'ready';
  }

  async destroy(): Promise<void> {
    this.status = 'destroying';
    this.nodes.clear();
    this.status = 'destroyed';
  }

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const normalizedPath = this.normalizePath(path);
    const node = this.nodes.get(normalizedPath);

    if (!node || node.type !== 'file') {
      throw new FileNotFoundError(path);
    }

    if (options?.encoding) {
      return node.content.toString(options.encoding);
    }
    return Buffer.from(node.content);
  }

  async writeFile(path: string, content: FileContent, _options?: WriteOptions): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    this.assertWritable(path, 'writeFile');

    this.ensureParentDirs(normalizedPath);

    const existingNode = this.nodes.get(normalizedPath);
    const now = new Date();

    this.nodes.set(normalizedPath, {
      type: 'file',
      content: typeof content === 'string' ? Buffer.from(content, 'utf-8') : Buffer.from(content),
      createdAt: existingNode?.type === 'file' ? existingNode.createdAt : now,
      modifiedAt: now,
    });
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    this.assertWritable(path, 'appendFile');

    let existing = Buffer.alloc(0);
    try {
      const current = await this.readFile(path);
      existing = typeof current === 'string' ? Buffer.from(current) : Buffer.from(current);
    } catch {
      // File doesn't exist, start fresh
    }

    const appendContent = typeof content === 'string' ? Buffer.from(content, 'utf-8') : Buffer.from(content);
    await this.writeFile(normalizedPath, Buffer.concat([existing, appendContent]));
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    this.assertWritable(path, 'deleteFile');

    const node = this.nodes.get(normalizedPath);
    if (!node) {
      if (options?.force) return;
      throw new FileNotFoundError(path);
    }

    if (node.type === 'directory') {
      await this.rmdir(path, options);
      return;
    }

    this.nodes.delete(normalizedPath);
  }

  async copyFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    const content = await this.readFile(src);
    await this.writeFile(dest, content);
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.copyFile(src, dest, options);
    await this.deleteFile(src, { force: true });
  }

  async mkdir(path: string, _options?: { recursive?: boolean }): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    this.assertWritable(path, 'mkdir');

    this.ensureParentDirs(normalizedPath);

    if (!this.nodes.has(normalizedPath)) {
      this.nodes.set(normalizedPath, { type: 'directory', createdAt: new Date(), modifiedAt: new Date() });
    }
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    this.assertWritable(path, 'rmdir');

    if (!options?.recursive) {
      // Check if empty
      const children = this.getChildren(normalizedPath);
      if (children.length > 0) {
        throw new Error(`Directory not empty: ${path}`);
      }
    } else {
      // Delete all children
      const prefix = normalizedPath === '/' ? '/' : normalizedPath + '/';
      for (const key of this.nodes.keys()) {
        if (key.startsWith(prefix) && key !== normalizedPath) {
          this.nodes.delete(key);
        }
      }
    }

    if (normalizedPath !== '/') {
      this.nodes.delete(normalizedPath);
    }
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    const normalizedPath = this.normalizePath(path);
    const entries: FileEntry[] = [];
    const seen = new Set<string>();

    const prefix = normalizedPath === '/' ? '/' : normalizedPath + '/';

    for (const [key, node] of this.nodes.entries()) {
      if (!key.startsWith(prefix) || key === normalizedPath) continue;

      const relativePath = key.slice(prefix.length);
      const parts = relativePath.split('/');

      if (options?.recursive) {
        // Include all nested entries
        if (options?.extension) {
          const extensions = Array.isArray(options.extension) ? options.extension : [options.extension];
          if (node.type === 'file' && !extensions.some(ext => key.endsWith(ext))) continue;
        }
        entries.push({
          name: relativePath,
          type: node.type,
          size: node.type === 'file' ? node.content.length : undefined,
        });
      } else {
        // Only immediate children
        const name = parts[0];
        if (!name) continue;
        if (seen.has(name)) continue;
        seen.add(name);

        if (parts.length > 1) {
          // It's a directory (has nested content)
          entries.push({ name, type: 'directory' });
        } else {
          if (options?.extension) {
            const extensions = Array.isArray(options.extension) ? options.extension : [options.extension];
            if (node.type === 'file' && !extensions.some(ext => name.endsWith(ext))) continue;
          }
          entries.push({
            name,
            type: node.type,
            size: node.type === 'file' ? node.content.length : undefined,
          });
        }
      }
    }

    return entries;
  }

  private getChildren(path: string): string[] {
    const prefix = path === '/' ? '/' : path + '/';
    const children: string[] = [];

    for (const key of this.nodes.keys()) {
      if (key.startsWith(prefix) && key !== path) {
        const relative = key.slice(prefix.length);
        if (!relative.includes('/')) {
          children.push(key);
        }
      }
    }

    return children;
  }

  async exists(path: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(path);
    return this.nodes.has(normalizedPath);
  }

  async stat(path: string): Promise<FileStat> {
    const normalizedPath = this.normalizePath(path);
    const node = this.nodes.get(normalizedPath);

    if (!node) {
      throw new FileNotFoundError(path);
    }

    const name = normalizedPath.split('/').pop() ?? '';

    return {
      name,
      path: normalizedPath,
      type: node.type,
      size: node.type === 'file' ? node.content.length : 0,
      createdAt: node.createdAt,
      modifiedAt: node.modifiedAt,
    };
  }

  async isFile(path: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(path);
    const node = this.nodes.get(normalizedPath);
    return node?.type === 'file';
  }

  async isDirectory(path: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(path);
    const node = this.nodes.get(normalizedPath);
    return node?.type === 'directory';
  }

  getInstructions(): string {
    return 'In-memory mock filesystem for testing.';
  }
}
